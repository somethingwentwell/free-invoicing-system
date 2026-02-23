drop policy if exists "org owner insert" on public.organizations;

create policy "org owner insert" on public.organizations
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
  );
