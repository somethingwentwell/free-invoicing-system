import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { lineItemTemplateSchema } from '@/lib/validations';

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  let query = auth.supabase
    .from('line_item_templates')
    .select('*')
    .order('name', { ascending: true });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (organizationId && Array.isArray(data) && data.length === 0) {
    const { data: fallbackData, error: fallbackError } = await auth.supabase
      .from('line_item_templates')
      .select('*')
      .order('name', { ascending: true });

    if (!fallbackError) return NextResponse.json(fallbackData ?? []);
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const body = await request.json();
  const parsed = lineItemTemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const { data, error } = await auth.supabase
    .from('line_item_templates')
    .upsert(
      {
        organization_id: payload.organization_id,
        name: payload.name.trim(),
        description: payload.description,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        currency: payload.currency.trim().toUpperCase() || 'USD',
        created_by: auth.user.id
      },
      { onConflict: 'organization_id,name' }
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
