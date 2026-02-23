create table if not exists public.document_note_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  content text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.document_note_templates enable row level security;

create policy "note templates org member access" on public.document_note_templates
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop trigger if exists document_note_templates_touch_updated_at on public.document_note_templates;
create trigger document_note_templates_touch_updated_at
before update on public.document_note_templates
for each row execute function public.touch_updated_at();
