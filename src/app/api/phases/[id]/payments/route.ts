import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createNextDocumentNumber, createReceiptNumberFromInvoice } from '@/lib/numbering';
import { paymentSchema } from '@/lib/validations';

async function generateUniqueReceiptNumber(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  organizationId: string,
  startSequence: number
) {
  let sequence = Math.max(1, startSequence);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = createNextDocumentNumber('receipt', sequence);
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

  throw new Error('Failed to generate unique receipt number');
}

async function generateUniqueRelatedReceiptNumber(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  organizationId: string,
  sourceNumber: string,
  phaseCode: string | null,
  relatedStartIndex: number
) {
  let index = Math.max(1, relatedStartIndex);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = createReceiptNumberFromInvoice(sourceNumber, { phaseCode, index });
    if (!candidate) break;

    const { data: existing, error } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('number', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return candidate;
    index += 1;
  }

  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const body = await request.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: phase, error: phaseError } = await auth.supabase
    .from('invoice_payment_phases')
    .select('*')
    .eq('id', id)
    .single();

  if (phaseError) return NextResponse.json({ error: phaseError.message }, { status: 404 });

  const { data: sourceDocument, error: sourceDocumentError } = await auth.supabase
    .from('documents')
    .select('*')
    .eq('id', phase.document_id)
    .single();

  if (sourceDocumentError) {
    return NextResponse.json({ error: sourceDocumentError.message }, { status: 404 });
  }

  const { data: payment, error: paymentError } = await auth.supabase
    .from('payments')
    .insert({
      phase_id: id,
      organization_id: phase.organization_id,
      amount: parsed.data.amount,
      paid_on: parsed.data.paid_on,
      note: parsed.data.note ?? null,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 400 });

  const { data: allPayments } = await auth.supabase.from('payments').select('amount').eq('phase_id', id);
  const totalPaidOnPhase = (allPayments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const phasePaid = totalPaidOnPhase >= phase.phase_amount;

  await auth.supabase.from('invoice_payment_phases').update({ is_paid: phasePaid }).eq('id', id);

  const { data: phaseList } = await auth.supabase
    .from('invoice_payment_phases')
    .select('id, phase_amount, is_paid, created_at')
    .eq('document_id', phase.document_id);

  const fullyPaid = (phaseList ?? []).every((p) => p.is_paid);
  const nextInvoiceStatus = fullyPaid ? 'paid' : 'partially_paid';
  await auth.supabase.from('documents').update({ status: nextInvoiceStatus }).eq('id', phase.document_id);
  const orderedPhases = [...(phaseList ?? [])].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return aTime - bTime;
  });
  const phaseIndex = orderedPhases.findIndex((item) => item.id === phase.id) + 1;
  const phaseCode = phaseIndex > 0 ? `PH${String(phaseIndex).padStart(2, '0')}` : null;

  const { count } = await auth.supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', phase.organization_id)
    .eq('type', 'receipt');

  const { count: relatedCount } = await auth.supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', phase.organization_id)
    .eq('type', 'receipt')
    .eq('payment_group_invoice_id', phase.document_id);

  const relatedNumber = await generateUniqueRelatedReceiptNumber(
    auth.supabase,
    phase.organization_id,
    sourceDocument.number,
    phaseCode,
    (relatedCount ?? 0) + 1
  );
  const receiptNumber =
    relatedNumber ?? (await generateUniqueReceiptNumber(auth.supabase, phase.organization_id, (count ?? 0) + 1));

  const { data: receipt, error: receiptError } = await auth.supabase
    .from('documents')
    .insert({
      organization_id: phase.organization_id,
      client_id: sourceDocument.client_id,
      type: 'receipt',
      status: 'paid',
      number: receiptNumber,
      issue_date: parsed.data.paid_on,
      due_date: null,
      currency: sourceDocument.currency,
      tax_percentage: 0,
      subtotal: parsed.data.amount,
      tax_amount: 0,
      total_amount: parsed.data.amount,
      notes: sourceDocument.number
        ? `Receipt for invoice ${sourceDocument.number} - ${
            Number(sourceDocument.total_amount) > 0
              ? ((Number(parsed.data.amount) / Number(sourceDocument.total_amount)) * 100).toFixed(2)
              : '0.00'
          }% (${Number(parsed.data.amount).toFixed(2)} / ${Number(sourceDocument.total_amount).toFixed(2)})`
        : null,
      parent_document_id: phase.document_id,
      payment_group_invoice_id: phase.document_id,
      payment_phase_id: phase.id,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 400 });

  await auth.supabase.from('document_conversions').insert({
    source_document_id: phase.document_id,
    target_document_id: receipt.id,
    organization_id: phase.organization_id,
    converted_by: auth.user.id,
    reason: 'payment_phase'
  });

  return NextResponse.json({ payment, receipt }, { status: 201 });
}
