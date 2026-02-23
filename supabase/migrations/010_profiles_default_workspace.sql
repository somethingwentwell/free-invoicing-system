alter table public.profiles
  add column if not exists default_organization_id uuid references public.organizations(id) on delete set null;
