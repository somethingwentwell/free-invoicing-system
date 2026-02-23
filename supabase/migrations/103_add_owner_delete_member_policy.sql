drop policy if exists "owner can delete members" on public.organization_members;

create policy "owner can delete members" on public.organization_members
  for delete
  to authenticated
  using (
    public.is_org_owner(organization_id)
  );
