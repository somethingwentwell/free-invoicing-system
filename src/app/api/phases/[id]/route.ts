import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { data: phase, error: phaseError } = await auth.supabase
    .from('invoice_payment_phases')
    .select('id, title, document_id')
    .eq('id', id)
    .single();

  if (phaseError) return NextResponse.json({ error: phaseError.message }, { status: 404 });

  const exact = await auth.supabase
    .from('documents')
    .select('id, number, created_at')
    .eq('type', 'receipt')
    .eq('payment_phase_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exact.data) {
    return NextResponse.json({ receipt: { id: exact.data.id, number: exact.data.number } });
  }

  const fallback = await auth.supabase
    .from('documents')
    .select('id, number, created_at')
    .eq('type', 'receipt')
    .eq('payment_group_invoice_id', phase.document_id)
    .ilike('notes', `%${phase.title}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback.data) {
    return NextResponse.json({ receipt: { id: fallback.data.id, number: fallback.data.number } });
  }

  return NextResponse.json({ receipt: null });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { error } = await auth.supabase.from('invoice_payment_phases').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
