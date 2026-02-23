'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface LineItemTemplate {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  currency?: string | null;
}

interface ApiErrorResponse {
  error?: unknown;
}

export function LineItemTemplatesManager() {
  const { organizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<LineItemTemplate[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [form, setForm] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    currency: 'USD'
  });
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingForm, setEditingForm] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    currency: 'USD'
  });

  async function parseApiError(response: Response, fallback: string) {
    const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function load() {
    const query = organizationId ? `?organization_id=${organizationId}` : '';
    const response = await fetch(`/api/line-item-templates${query}`);
    if (!response.ok) {
      setMessage(await parseApiError(response, t('line_item_template_save_failed')));
      setTemplates([]);
      return;
    }
    const data = await response.json();
    setTemplates(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, [organizationId]);

  useEffect(() => {
    async function loadDefaultCurrency() {
      if (!organizationId) return;
      const response = await fetch(`/api/organizations/${organizationId}`);
      const data = (await response.json().catch(() => null)) as { default_currency?: string | null } | null;
      if (!response.ok) return;
      const nextCurrency = data?.default_currency?.trim().toUpperCase() || 'USD';
      setDefaultCurrency(nextCurrency);
      setForm((prev) => ({ ...prev, currency: nextCurrency }));
    }

    void loadDefaultCurrency();
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
    if (!form.description.trim()) {
      setMessage(t('line_item_template_requires_item'));
      return;
    }

    const response = await fetch('/api/line-item-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        name: form.name.trim(),
        description: form.description.trim(),
        quantity: Number(form.quantity),
        unit_price: Number(form.unit_price),
        currency: form.currency.trim().toUpperCase() || defaultCurrency
      })
    });

    if (!response.ok) {
      setMessage(await parseApiError(response, t('line_item_template_save_failed')));
      return;
    }

    setForm({ name: '', description: '', quantity: 1, unit_price: 0, currency: defaultCurrency });
    setMessage(t('line_item_template_saved'));
    await load();
  }

  function startEdit(template: LineItemTemplate) {
    setEditingId(template.id);
    setEditingForm({
      name: template.name,
      description: template.description,
      quantity: Number(template.quantity),
      unit_price: Number(template.unit_price),
      currency: template.currency?.trim().toUpperCase() || defaultCurrency
    });
    setMessage('');
  }

  async function updateTemplate(id: string) {
    if (!editingForm.name.trim()) {
      setMessage(t('template_name_required'));
      return;
    }
    if (!editingForm.description.trim()) {
      setMessage(t('line_item_template_requires_item'));
      return;
    }

    const response = await fetch(`/api/line-item-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingForm.name.trim(),
        description: editingForm.description.trim(),
        quantity: Number(editingForm.quantity),
        unit_price: Number(editingForm.unit_price),
        currency: editingForm.currency.trim().toUpperCase() || defaultCurrency
      })
    });

    if (!response.ok) {
      setMessage(await parseApiError(response, t('line_item_template_update_failed')));
      return;
    }

    setEditingId('');
    setMessage(t('line_item_template_updated'));
    await load();
  }

  async function removeTemplate(id: string) {
    const response = await fetch(`/api/line-item-templates/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setMessage(await parseApiError(response, t('line_item_template_delete_failed')));
      return;
    }

    if (editingId === id) setEditingId('');
    setMessage(t('line_item_template_deleted'));
    await load();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('line_item_template_management')}</h1>

      <div className="surface space-y-3 p-4">
        <form onSubmit={createTemplate} className="grid gap-2 md:grid-cols-6">
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
            <span>{t('description')}</span>
            <input
              placeholder={t('description')}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('quantity')}</span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              placeholder={t('quantity')}
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value || '0') }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('unit_price')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder={t('unit_price')}
              value={form.unit_price}
              onChange={(e) => setForm((prev) => ({ ...prev, unit_price: Number(e.target.value || '0') }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('currency')}</span>
            <input
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              placeholder={defaultCurrency}
              required
            />
          </label>
          <div className="md:col-span-6">
            <button className="h-[42px]" type="submit">{t('save_template')}</button>
          </div>
        </form>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-3 py-2 text-left">{t('template_name')}</th>
                <th className="px-3 py-2 text-left">{t('description')}</th>
                <th className="px-3 py-2 text-left">{t('quantity')}</th>
                <th className="px-3 py-2 text-left">{t('unit_price')}</th>
                <th className="px-3 py-2 text-left">{t('currency')}</th>
                <th className="px-3 py-2 text-left">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const isEditing = editingId === template.id;
                return (
                  <tr key={template.id} className="border-t border-slate-200/70">
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingForm.description}
                          onChange={(e) => setEditingForm((prev) => ({ ...prev, description: e.target.value }))}
                          required
                        />
                      ) : (
                        template.description
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={editingForm.quantity}
                          onChange={(e) => setEditingForm((prev) => ({ ...prev, quantity: Number(e.target.value || '0') }))}
                          required
                        />
                      ) : (
                        Number(template.quantity).toFixed(2)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={editingForm.unit_price}
                          onChange={(e) =>
                            setEditingForm((prev) => ({ ...prev, unit_price: Number(e.target.value || '0') }))
                          }
                          required
                        />
                      ) : (
                        Number(template.unit_price).toFixed(2)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingForm.currency}
                          onChange={(e) =>
                            setEditingForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
                          }
                          required
                        />
                      ) : (
                        template.currency?.trim().toUpperCase() || defaultCurrency
                      )}
                    </td>
                    <td className="px-3 py-2">
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
