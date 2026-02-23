import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

interface WorkspaceSettingsBody {
  logo_url?: string | null;
  company_name?: string | null;
  company_email?: string | null;
  company_address?: string | null;
  default_currency?: string | null;
}

function hasWorkspaceColumnError(message: string) {
  return (
    message.includes("logo_url") ||
    message.includes("company_name") ||
    message.includes("company_email") ||
    message.includes("company_address") ||
    message.includes("default_currency")
  );
}

function normalizeOptional(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { data, error } = await auth.supabase
    .from('organizations')
    .select('id, name, logo_url, company_name, company_email, company_address, default_currency')
    .eq('id', id)
    .single();

  if (error) {
    if (hasWorkspaceColumnError(error.message)) {
      const fallback = await auth.supabase.from('organizations').select('id, name').eq('id', id).single();
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 400 });

      return NextResponse.json({
        ...fallback.data,
        logo_url: null,
        company_name: null,
        company_email: null,
        company_address: null,
        default_currency: null
      });
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { data: ownerMembership } = await auth.supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', id)
    .eq('user_id', auth.user.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (!ownerMembership) {
    return NextResponse.json({ error: 'Only owners can update workspace settings' }, { status: 403 });
  }

  const body = (await request.json()) as WorkspaceSettingsBody;

  const payload = {
    logo_url: normalizeOptional(body.logo_url),
    company_name: normalizeOptional(body.company_name),
    company_email: normalizeOptional(body.company_email),
    company_address: normalizeOptional(body.company_address),
    default_currency: normalizeOptional(body.default_currency)?.toUpperCase() ?? null
  };

  const { data, error } = await auth.supabase
    .from('organizations')
    .update(payload)
    .eq('id', id)
    .select('id, name, logo_url, company_name, company_email, company_address, default_currency')
    .single();

  if (error) {
    if (hasWorkspaceColumnError(error.message)) {
      return NextResponse.json(
        {
          error:
            'Workspace profile columns are missing. Please run migrations 011_workspace_profile_fields.sql and 012_workspace_default_currency.sql.'
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;

  const { data: ownerMembership } = await auth.supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', id)
    .eq('user_id', auth.user.id)
    .eq('role', 'owner')
    .maybeSingle();

  if (!ownerMembership) {
    return NextResponse.json({ error: 'Only owners can delete workspace' }, { status: 403 });
  }

  const { count: totalWorkspaces } = await auth.supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id);

  if ((totalWorkspaces ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot delete your last workspace' }, { status: 400 });
  }

  const { error } = await auth.supabase.from('organizations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await auth.supabase
    .from('profiles')
    .update({ default_organization_id: null })
    .eq('id', auth.user.id)
    .eq('default_organization_id', id);

  return NextResponse.json({ success: true });
}
