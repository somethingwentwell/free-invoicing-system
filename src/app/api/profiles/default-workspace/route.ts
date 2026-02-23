import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { data, error } = await auth.supabase
    .from('profiles')
    .select('default_organization_id')
    .eq('id', auth.user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ default_organization_id: data?.default_organization_id ?? null });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const body = (await request.json()) as { organization_id?: string | null };
  const organizationId = body.organization_id ?? null;

  if (organizationId) {
    const { data: membership, error: membershipError } = await auth.supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
    if (!membership) return NextResponse.json({ error: 'Invalid workspace' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('profiles')
    .update({ default_organization_id: organizationId })
    .eq('id', auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ default_organization_id: organizationId });
}
