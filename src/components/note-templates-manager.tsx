'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface NoteTemplate {
  id: string;
  name: string;
  content: string;
}

interface ApiErrorResponse {
  error?: unknown;
}

export function NoteTemplatesManager() {
  const { organizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([]);
  const [form, setForm] = useState({ name: '', content: '' });
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingForm, setEditingForm] = useState({ name: '', content: '' });

  async function parseApiError(response: Response, fallback: string) {
    const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function load() {
    const query = organizationId ? `?organization_id=${organizationId}` : '';
    const response = await fetch(`/api/document-note-templates${query}`);
    if (!response.ok) {
      setMessage(await parseApiError(response, t('template_save_failed')));
      setNoteTemplates([]);
      return;
    }
    const data = await response.json();
    setNoteTemplates(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, [organizationId]);

  async function createTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) {
      setMessage(t('workspace_required_for_save'));
      return;
    }
    if (!form.name.trim()) {
      setMessage(t('template_name_required'));
      return;
    }
    if (!form.content.trim()) {
      setMessage(t('note_template_requires_notes'));
      return;
    }

    const response = await fetch('/api/document-note-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        name: form.name.trim(),
        content: form.content
      })
    });

    if (!response.ok) {
      setMessage(await parseApiError(response, t('template_save_failed')));
      return;
    }

    setForm({ name: '', content: '' });
    setMessage(t('template_saved'));
    await load();
  }

  function startEdit(template: NoteTemplate) {
    setEditingId(template.id);
    setEditingForm({ name: template.name, content: template.content });
    setMessage('');
  }

  async function updateTemplate(id: string) {
    if (!editingForm.name.trim()) {
      setMessage(t('template_name_required'));
      return;
    }
    if (!editingForm.content.trim()) {
      setMessage(t('note_template_requires_notes'));
      return;
    }

    const response = await fetch(`/api/document-note-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingForm.name.trim(),
        content: editingForm.content
      })
    });

    if (!response.ok) {
      setMessage(await parseApiError(response, t('template_update_failed')));
      return;
    }

    setEditingId('');
    setMessage(t('template_updated'));
    await load();
  }

  async function removeTemplate(id: string) {
    const response = await fetch(`/api/document-note-templates/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setMessage(await parseApiError(response, t('template_delete_failed')));
      return;
    }

    if (editingId === id) setEditingId('');
    setMessage(t('template_deleted'));
    await load();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('note_template_management')}</h1>

      <div className="surface space-y-3 p-4">
        <form onSubmit={createTemplate} className="grid gap-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('template_name')}</span>
            <input
              placeholder={t('template_name')}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('notes')}</span>
            <textarea
              placeholder={t('notes')}
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              required
            />
          </label>
          <div>
            <button className="h-[42px]" type="submit">{t('save_template')}</button>
          </div>
        </form>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-3 py-2 text-left">{t('template_name')}</th>
                <th className="px-3 py-2 text-left">{t('notes')}</th>
                <th className="px-3 py-2 text-left">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {noteTemplates.map((template) => {
                const isEditing = editingId === template.id;
                return (
                  <tr key={template.id} className="border-t border-slate-200/70">
                    <td className="px-3 py-2 align-top">
                      {isEditing ? (
                        <input
                          value={editingForm.name}
                          onChange={(e) => setEditingForm((prev) => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      ) : (
                        template.name
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {isEditing ? (
                        <textarea
                          value={editingForm.content}
                          onChange={(e) => setEditingForm((prev) => ({ ...prev, content: e.target.value }))}
                          required
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{template.content}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                              onClick={() => void updateTemplate(template.id)}
                            >
                              {t('save')}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                              onClick={() => setEditingId('')}
                            >
                              {t('cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                            onClick={() => startEdit(template)}
                          >
                            {t('edit')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                          onClick={() => void removeTemplate(template.id)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
