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

drop policy if exists "members readable by org members" on public.organization_members;

create policy "members readable by org members" on public.organization_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_owner(organization_id)
  );
