import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id, memberId } = await params;

  const { data: ownerMembership } = await auth.supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', id)
    .eq('user_id', auth.user.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (!ownerMembership) {
    return NextResponse.json({ error: 'Only owners can remove members' }, { status: 403 });
  }

  const { data: targetMembership, error: targetMembershipError } = await auth.supabase
    .from('organization_members')
    .select('id, user_id, role')
    .eq('organization_id', id)
    .eq('id', memberId)
    .single();

  if (targetMembershipError || !targetMembership) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (targetMembership.user_id === auth.user.id) {
    return NextResponse.json({ error: 'Owner cannot remove self' }, { status: 400 });
  }

  if (targetMembership.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove another owner' }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', id)
    .eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
