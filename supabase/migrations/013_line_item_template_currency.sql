alter table public.line_item_templates
  add column if not exists currency text;

update public.line_item_templates
set currency = 'USD'
where currency is null or btrim(currency) = '';

alter table public.line_item_templates
  alter column currency set default 'USD';

alter table public.line_item_templates
  alter column currency set not null;
