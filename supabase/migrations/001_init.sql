create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_name text not null,
  company_name text not null,
  phone text,
  email text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  parent_document_id uuid references public.documents(id) on delete set null,
  payment_group_invoice_id uuid references public.documents(id) on delete set null,
  payment_phase_id uuid,
  type text not null check (type in ('quotation', 'invoice', 'receipt')),
  status text not null check (status in ('draft', 'sent', 'accepted', 'rejected', 'partially_paid', 'paid', 'overdue')),
  number text not null,
  issue_date date not null,
  due_date date,
  currency text not null default 'USD',
  tax_percentage numeric(8,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.document_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  target_document_id uuid not null references public.documents(id) on delete cascade,
  reason text,
  converted_by uuid not null references auth.users(id) on delete restrict,
  converted_at timestamptz not null default now()
);

create table if not exists public.invoice_payment_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('percentage', 'fixed')),
  value numeric(12,2) not null,
  phase_amount numeric(12,2) not null,
  due_date date,
  is_paid boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.documents
  add constraint fk_documents_phase
  foreign key (payment_phase_id)
  references public.invoice_payment_phases(id)
  on delete set null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phase_id uuid not null references public.invoice_payment_phases(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_on date not null,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  insert into public.profiles (id, email) values (new.id, new.email);

  insert into public.organizations (name, created_by)
  values (coalesce(split_part(new.email, '@', 1), 'workspace') || ' workspace', new.id)
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
alter table public.documents enable row level security;
alter table public.document_items enable row level security;
alter table public.document_conversions enable row level security;
alter table public.invoice_payment_phases enable row level security;
alter table public.payments enable row level security;

create policy "profiles self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles read for authenticated users" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "org readable by members" on public.organizations
  for select using (public.is_org_member(id));

create policy "org owner insert" on public.organizations
  for insert with check (created_by = auth.uid());

create policy "members readable by org members" on public.organization_members
  for select using (public.is_org_member(organization_id));

create policy "owner can add members" on public.organization_members
  for insert with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = organization_id and om.user_id = auth.uid() and om.role = 'owner'
    )
  );

create policy "clients org member access" on public.clients
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "documents org member access" on public.documents
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "items org member access" on public.document_items
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_org_member(d.organization_id)
    )
  ) with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.is_org_member(d.organization_id)
    )
  );

create policy "conversions org member access" on public.document_conversions
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "phases org member access" on public.invoice_payment_phases
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "payments org member access" on public.payments
  for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
before update on public.clients
for each row execute function public.touch_updated_at();

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at
before update on public.documents
for each row execute function public.touch_updated_at();
