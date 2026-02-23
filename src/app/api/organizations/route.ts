import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { data, error } = await auth.supabase
    .from('organization_members')
    .select('role, organizations(id, name)')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    (data ?? []).flatMap((item) => {
      const org = item.organizations as { id: string; name: string } | Array<{ id: string; name: string }> | null;
      if (!org) return [];
      const orgs = Array.isArray(org) ? org : [org];
      return orgs.map((entry) => ({
        id: entry.id,
        name: entry.name,
        role: item.role
      }));
    })
  );
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const organizationId = crypto.randomUUID();
  const { error: orgError } = await auth.supabase
    .from('organizations')
    .insert({ id: organizationId, name, created_by: auth.user.id });

  if (orgError) {
    return NextResponse.json({ error: orgError?.message ?? 'Failed to create workspace' }, { status: 400 });
  }

  const { error: memberError } = await auth.supabase.from('organization_members').insert({
    organization_id: organizationId,
    user_id: auth.user.id,
    role: 'owner'
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ id: organizationId, name }, { status: 201 });
}
