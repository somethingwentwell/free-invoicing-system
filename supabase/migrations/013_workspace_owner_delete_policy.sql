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
