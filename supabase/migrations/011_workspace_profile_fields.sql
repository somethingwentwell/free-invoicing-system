alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists company_name text,
  add column if not exists company_email text,
  add column if not exists company_address text;

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
