import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateTotals } from '@/lib/math';
import { requireUser } from '@/lib/auth';
import { documentSchema } from '@/lib/validations';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { data: document, error: docError } = await auth.supabase
    .from('documents')
    .select('*, clients(*)')
    .eq('id', id)
    .single();

  if (docError) return NextResponse.json({ error: docError.message }, { status: 404 });

  const { data: items, error: itemsError } = await auth.supabase
    .from('document_items')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: true });

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  const { data: phases } = await auth.supabase
    .from('invoice_payment_phases')
    .select('*, payments(*)')
    .eq('document_id', id)
    .order('created_at', { ascending: true });

  const phaseIds = (phases ?? []).map((phase) => phase.id);
  const orderedPhases = [...(phases ?? [])].sort(
    (a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime()
  );
  const phaseIdByCode = new Map<string, string>();
  orderedPhases.forEach((phase, index) => {
    phaseIdByCode.set(`PH${String(index + 1).padStart(2, '0')}`, String(phase.id));
  });
  let receiptsByPhase = new Map<string, Array<{ id: string; number: string; created_at: string }>>();

  if (phaseIds.length > 0) {
    const { data: receipts } = await auth.supabase
      .from('documents')
      .select('id, number, created_at, payment_phase_id, type')
      .eq('type', 'receipt')
      .or(`payment_group_invoice_id.eq.${id},parent_document_id.eq.${id}`);

    for (const receipt of receipts ?? []) {
      let phaseId = receipt.payment_phase_id as string | null;

      if (!phaseId && typeof receipt.number === 'string') {
        const match = receipt.number.toUpperCase().match(/-PH(\d{2})/);
        if (match) {
          const code = `PH${match[1]}`;
          phaseId = phaseIdByCode.get(code) ?? null;
        }
      }

      if (!phaseId) continue;

      const list = receiptsByPhase.get(phaseId) ?? [];
      list.push({ id: receipt.id as string, number: receipt.number as string, created_at: receipt.created_at as string });
      receiptsByPhase.set(phaseId, list);
    }
  }

  const phasesWithReceipts = (phases ?? []).map((phase) => ({
    ...phase,
    receipts: (receiptsByPhase.get(phase.id as string) ?? [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((receipt) => ({ id: receipt.id, number: receipt.number }))
  }));

  return NextResponse.json({ ...document, items, phases: phasesWithReceipts });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const body = await request.json();
  const parsed = documentSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const items = payload.items ?? [];
  const taxPercentage = payload.tax_percentage ?? 0;
  const totals = items.length > 0 ? calculateTotals(items, taxPercentage) : null;
  const receiptTotalParsed = z.number().nonnegative().safeParse(body.total_amount);

  const { data: currentDocument, error: currentDocumentError } = await auth.supabase
    .from('documents')
    .select('id, type')
    .eq('id', id)
    .single();

  if (currentDocumentError) {
    return NextResponse.json({ error: currentDocumentError.message }, { status: 404 });
  }

  const isReceipt = currentDocument.type === 'receipt';
  if (body.total_amount !== undefined && !receiptTotalParsed.success) {
    return NextResponse.json({ error: 'Invalid total_amount' }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (payload.client_id !== undefined) updatePayload.client_id = payload.client_id;
  if (payload.number !== undefined) updatePayload.number = payload.number;
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.issue_date !== undefined) updatePayload.issue_date = payload.issue_date;
  if (payload.due_date !== undefined) updatePayload.due_date = payload.due_date;
  if (payload.currency !== undefined) updatePayload.currency = payload.currency;
  if (payload.tax_percentage !== undefined) updatePayload.tax_percentage = payload.tax_percentage;
  if (payload.notes !== undefined) updatePayload.notes = payload.notes;

  if (totals) {
    updatePayload.subtotal = totals.subtotal;
    updatePayload.tax_amount = totals.tax_amount;
    updatePayload.total_amount = totals.total_amount;
  }

  if (isReceipt && receiptTotalParsed.success) {
    const nextTotal = Number(receiptTotalParsed.data.toFixed(2));
    updatePayload.subtotal = nextTotal;
    updatePayload.tax_amount = 0;
    updatePayload.total_amount = nextTotal;
    updatePayload.tax_percentage = 0;
  }

  const { data: document, error: documentError } = await auth.supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 400 });

  if (isReceipt) {
    const { error: clearItemsError } = await auth.supabase.from('document_items').delete().eq('document_id', id);
    if (clearItemsError) return NextResponse.json({ error: clearItemsError.message }, { status: 400 });
  } else if (items.length > 0) {
    await auth.supabase.from('document_items').delete().eq('document_id', id);
    const { error: itemsError } = await auth.supabase.from('document_items').insert(
      items.map((item) => ({
        document_id: id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: Number((item.quantity * item.unit_price).toFixed(2))
      }))
    );

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  return NextResponse.json(document);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const { error } = await auth.supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
