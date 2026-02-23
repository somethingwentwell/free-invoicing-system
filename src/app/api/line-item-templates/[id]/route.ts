import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { lineItemTemplateSchema } from '@/lib/validations';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const body = await request.json();
  const parsed = lineItemTemplateSchema
    .pick({ name: true, description: true, quantity: true, unit_price: true, currency: true })
    .partial()
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updatePayload = {
    ...parsed.data,
    ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency.trim().toUpperCase() || 'USD' } : {})
  };

  const { data, error } = await auth.supabase
    .from('line_item_templates')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const { error } = await auth.supabase.from('line_item_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
