drop policy if exists "note templates org member access" on public.document_note_templates;
drop policy if exists "line item templates org member access" on public.line_item_templates;

create policy "note templates by creator" on public.document_note_templates
  for all
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "line item templates by creator" on public.line_item_templates
  for all
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
