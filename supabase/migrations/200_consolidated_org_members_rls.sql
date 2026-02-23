-- Consolidated repair script for organization_members RLS.
-- This file supersedes 101/102/103/104 for org-member related policy fixes.
-- Safe to run multiple times.

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

create or replace function public.is_org_creator(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = org_id
      and o.created_by = auth.uid()
  );
$$;

drop policy if exists "members readable by org members" on public.organization_members;
drop policy if exists "owner can add members" on public.organization_members;
drop policy if exists "owner can delete members" on public.organization_members;

create policy "members readable by org members" on public.organization_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_owner(organization_id)
  );

create policy "owner can add members" on public.organization_members
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and public.is_org_creator(organization_id)
    )
    or public.is_org_owner(organization_id)
  );

create policy "owner can delete members" on public.organization_members
  for delete
  to authenticated
  using (
    public.is_org_owner(organization_id)
  );
