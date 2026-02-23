-- Consolidated migration for environments that need a single catch-up script.
-- Safe to run multiple times.

-- 1) Functions used by RLS policies (recursion-safe via security definer)
create or replace function public.is_org_member(org_id uuid)
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
  );
$$;

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

-- 2) Profiles / organizations catch-up columns
alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations(id) on delete set null;

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists company_name text,
  add column if not exists company_email text,
  add column if not exists company_address text,
  add column if not exists default_currency text;

-- 3) Line item template currency catch-up
alter table public.line_item_templates
  add column if not exists currency text;

update public.line_item_templates
set currency = 'USD'
where currency is null or btrim(currency) = '';

alter table public.line_item_templates
  alter column currency set default 'USD';

alter table public.line_item_templates
  alter column currency set not null;

-- 4) Organization policies (owner-managed)
drop policy if exists "org owner insert" on public.organizations;
create policy "org owner insert" on public.organizations
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
  );

drop policy if exists "org owner update" on public.organizations;
create policy "org owner update" on public.organizations
  for update
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.role = 'owner'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.role = 'owner'
    )
  );

drop policy if exists "org owner delete" on public.organizations;
create policy "org owner delete" on public.organizations
  for delete
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.role = 'owner'
    )
  );

-- 5) Organization member policies (owner can manage, no recursion in policy body)
drop policy if exists "members readable by org members" on public.organization_members;
create policy "members readable by org members" on public.organization_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_owner(organization_id)
  );

drop policy if exists "owner can add members" on public.organization_members;
create policy "owner can add members" on public.organization_members
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and not exists (
        select 1
        from public.organization_members existing
        where existing.organization_id = organization_id
      )
    )
    or public.is_org_owner(organization_id)
  );

-- 6) Template policies switched to creator-owned access
drop policy if exists "note templates org member access" on public.document_note_templates;
drop policy if exists "line item templates org member access" on public.line_item_templates;

drop policy if exists "note templates by creator" on public.document_note_templates;
create policy "note templates by creator" on public.document_note_templates
  for all
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "line item templates by creator" on public.line_item_templates;
create policy "line item templates by creator" on public.line_item_templates
  for all
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
