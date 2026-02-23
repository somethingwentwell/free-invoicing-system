import { NextResponse } from 'next/server';
import { calculateTotals } from '@/lib/math';
import { createInvoiceNumberFromQuotation, createNextDocumentNumber, createReceiptNumberFromInvoice } from '@/lib/numbering';
import { requireUser } from '@/lib/auth';
import type { DocumentType } from '@/types/domain';

function nextType(currentType: DocumentType): DocumentType | null {
  if (currentType === 'quotation') return 'invoice';
  if (currentType === 'invoice') return 'receipt';
  return null;
}

async function generateUniqueNumber(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  organizationId: string,
  type: DocumentType,
  startSequence: number
) {
  let sequence = Math.max(1, startSequence);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = createNextDocumentNumber(type, sequence);
    const { data: existing, error } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('number', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return candidate;
    sequence += 1;
  }

  throw new Error('Failed to generate unique document number');
}

async function resolveRelatedNumber(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  organizationId: string,
  buildCandidate: (index: number) => string | null,
  relatedStartIndex: number
) {
  let relatedIndex = Math.max(1, relatedStartIndex);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = buildCandidate(relatedIndex);
    if (!candidate) break;

    const { data: existing, error } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('number', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return candidate;
    relatedIndex += 1;
  }

  return null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const body = await _request.json().catch(() => ({} as { amount?: number }));

  const { data: source, error: sourceError } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 404 });

  const targetType = nextType(source.type as DocumentType);
  if (!targetType) return NextResponse.json({ error: 'Receipt cannot be converted further' }, { status: 400 });

  const { data: sourceItems, error: itemsError } = await auth.supabase
    .from('document_items')
    .select('*')
    .eq('document_id', id);

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  const { count } = await auth.supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', source.organization_id)
    .eq('type', targetType);

  let relatedStartIndex = 1;
  if (targetType === 'receipt') {
    const { count: relatedReceiptCount } = await auth.supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', source.organization_id)
      .eq('type', 'receipt')
      .eq('payment_group_invoice_id', source.id);
    relatedStartIndex = (relatedReceiptCount ?? 0) + 1;
  } else if (targetType === 'invoice') {
    const { count: relatedInvoiceCount } = await auth.supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', source.organization_id)
      .eq('type', 'invoice')
      .eq('parent_document_id', source.id);
    relatedStartIndex = (relatedInvoiceCount ?? 0) + 1;
  }

  const relatedNumber = await resolveRelatedNumber(
    auth.supabase,
    source.organization_id,
    (index) =>
      targetType === 'invoice'
        ? createInvoiceNumberFromQuotation(source.number, index)
        : createReceiptNumberFromInvoice(source.number, { index }),
    relatedStartIndex
  );
  const number =
    relatedNumber ?? (await generateUniqueNumber(auth.supabase, source.organization_id, targetType, (count ?? 0) + 1));
  const totals = calculateTotals(
    sourceItems.map((item) => ({ description: item.description, quantity: item.quantity, unit_price: item.unit_price })),
    source.tax_percentage
  );
  const requestedAmount = Number(body?.amount ?? 0);

  let receiptAmount = 0;
  let invoiceNextStatus: 'paid' | 'partially_paid' | null = null;
  let receiptNotes: string | null = null;

  if (targetType === 'receipt') {
    const { data: existingReceipts, error: receiptsError } = await auth.supabase
      .from('documents')
      .select('id,total_amount,payment_group_invoice_id,parent_document_id')
      .eq('type', 'receipt')
      .or(`payment_group_invoice_id.eq.${source.id},parent_document_id.eq.${source.id}`);

    if (receiptsError) return NextResponse.json({ error: receiptsError.message }, { status: 400 });

    const alreadyReceived = (existingReceipts ?? []).reduce((sum, receipt) => sum + Number(receipt.total_amount), 0);
    const remaining = Number((Math.max(0, Number(source.total_amount) - alreadyReceived)).toFixed(2));
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Invoice is already fully receipted' }, { status: 400 });
    }

    if (Number.isFinite(requestedAmount) && requestedAmount > 0) {
      if (requestedAmount > remaining) {
        return NextResponse.json({ error: `Receipt amount cannot exceed remaining (${remaining.toFixed(2)})` }, { status: 400 });
      }
      receiptAmount = Number(requestedAmount.toFixed(2));
    } else {
      receiptAmount = remaining;
    }

    const nextReceived = Number((alreadyReceived + receiptAmount).toFixed(2));
    invoiceNextStatus = nextReceived >= Number(source.total_amount) ? 'paid' : 'partially_paid';
    if (source.number) {
      const percent = Number(source.total_amount) > 0 ? (receiptAmount / Number(source.total_amount)) * 100 : 0;
      receiptNotes = `Receipt for invoice ${source.number} - ${percent.toFixed(2)}% (${receiptAmount.toFixed(2)} / ${Number(source.total_amount).toFixed(2)})`;
    } else {
      receiptNotes = null;
    }
  }

  const defaultStatus = targetType === 'receipt' ? 'paid' : 'draft';

  const { data: converted, error: convertedError } = await auth.supabase
    .from('documents')
    .insert({
      organization_id: source.organization_id,
      client_id: source.client_id,
      type: targetType,
      status: defaultStatus,
      number,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: targetType === 'invoice' ? source.due_date : null,
      currency: source.currency,
      tax_percentage: targetType === 'receipt' ? 0 : source.tax_percentage,
      subtotal: targetType === 'receipt' ? receiptAmount : totals.subtotal,
      tax_amount: targetType === 'receipt' ? 0 : totals.tax_amount,
      total_amount: targetType === 'receipt' ? receiptAmount : totals.total_amount,
      notes: targetType === 'receipt' ? receiptNotes : source.notes,
      parent_document_id: source.id,
      payment_group_invoice_id: targetType === 'receipt' ? source.id : null,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (convertedError) return NextResponse.json({ error: convertedError.message }, { status: 400 });

  if (targetType !== 'receipt') {
    const nextItems = sourceItems.map((item) => ({
      document_id: converted.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total
    }));

    const { error: newItemsError } = await auth.supabase.from('document_items').insert(nextItems);
    if (newItemsError) return NextResponse.json({ error: newItemsError.message }, { status: 400 });
  }

  if (source.type === 'invoice' && invoiceNextStatus) {
    const { error: invoiceUpdateError } = await auth.supabase
      .from('documents')
      .update({ status: invoiceNextStatus })
      .eq('id', source.id);

    if (invoiceUpdateError) return NextResponse.json({ error: invoiceUpdateError.message }, { status: 400 });
  }

  await auth.supabase.from('document_conversions').insert({
    source_document_id: source.id,
    target_document_id: converted.id,
    organization_id: source.organization_id,
    converted_by: auth.user.id
  });

  return NextResponse.json(converted, { status: 201 });
}
