alter table public.organizations
  add column if not exists default_currency text;
