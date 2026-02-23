drop policy if exists "owner can add members" on public.organization_members;

create policy "owner can add members" on public.organization_members
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1
        from public.organizations o
        where o.id = organization_id
          and o.created_by = auth.uid()
      )
    )
    or public.is_org_owner(organization_id)
  );
