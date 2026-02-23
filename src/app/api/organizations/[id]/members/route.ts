import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { data, error } = await auth.supabase
    .from('organization_members')
    .select('id, role, user_id')
    .eq('organization_id', id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userIds = (data ?? []).map((item) => item.user_id);
  if (userIds.length === 0) return NextResponse.json([]);

  const { data: profiles } = await auth.supabase.from('profiles').select('id, email').in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.email]));

  return NextResponse.json(
    (data ?? []).map((member) => ({
      ...member,
      email: profileMap.get(member.user_id) ?? null
    }))
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const body = (await request.json()) as { email?: string; role?: 'owner' | 'member' };
  const normalizedEmail = body.email?.trim().toLowerCase() ?? '';

  if (!normalizedEmail || !body.role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
  }

  const { data: ownerMembership } = await auth.supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', id)
    .eq('user_id', auth.user.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (!ownerMembership) {
    return NextResponse.json({ error: 'Only owners can add members' }, { status: 403 });
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User email not found. User must register first.' }, { status: 404 });
  }

  const { data, error } = await auth.supabase
    .from('organization_members')
    .insert({ organization_id: id, user_id: profile.id, role: body.role })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
