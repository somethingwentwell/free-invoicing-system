import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { clientSchema } from '@/lib/validations';

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  if (!organizationId) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const body = await request.json();
  const organizationId = body.organization_id as string | undefined;
  if (!organizationId) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });

  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('clients')
    .insert({
      ...parsed.data,
      organization_id: organizationId,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
