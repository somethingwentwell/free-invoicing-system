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
