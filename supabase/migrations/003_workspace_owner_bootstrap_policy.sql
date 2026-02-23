drop policy if exists "owner can add members" on public.organization_members;

create policy "owner can add members" on public.organization_members
  for insert with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and not exists (
        select 1
        from public.organization_members existing
        where existing.organization_id = organization_id
      )
    )
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = organization_id
        and om.user_id = auth.uid()
        and om.role = 'owner'
    )
  );
