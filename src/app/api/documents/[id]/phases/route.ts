import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { phaseSchema } from '@/lib/validations';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const body = await request.json();
  const parsed = phaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: invoice, error: invoiceError } = await auth.supabase
    .from('documents')
    .select('id, total_amount, organization_id, type')
    .eq('id', id)
    .single();

  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 404 });
  if (invoice.type !== 'invoice') {
    return NextResponse.json({ error: 'Payment phases are only allowed for invoices' }, { status: 400 });
  }

  const amount =
    parsed.data.kind === 'percentage'
      ? Number((invoice.total_amount * (parsed.data.value / 100)).toFixed(2))
      : Number(parsed.data.value.toFixed(2));

  const { data, error } = await auth.supabase
    .from('invoice_payment_phases')
    .insert({
      document_id: id,
      organization_id: invoice.organization_id,
      title: parsed.data.title,
      kind: parsed.data.kind,
      value: parsed.data.value,
      phase_amount: amount,
      due_date: parsed.data.due_date ?? null,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
