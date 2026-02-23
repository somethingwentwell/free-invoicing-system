create table if not exists public.line_item_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.line_item_templates enable row level security;

create policy "line item templates org member access" on public.line_item_templates
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop trigger if exists line_item_templates_touch_updated_at on public.line_item_templates;
create trigger line_item_templates_touch_updated_at
before update on public.line_item_templates
for each row execute function public.touch_updated_at();
