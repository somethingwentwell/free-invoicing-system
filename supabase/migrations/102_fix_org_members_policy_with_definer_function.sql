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

drop policy if exists "owner can add members" on public.organization_members;

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
