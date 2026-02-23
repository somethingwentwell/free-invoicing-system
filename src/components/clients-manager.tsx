'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface Client {
  id: string;
  client_name: string;
  company_name: string;
  phone: string | null;
  email: string | null;
}

interface ApiErrorResponse {
  error?: unknown;
}

export function ClientsManager() {
  const { organizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ client_name: '', company_name: '', phone: '', email: '' });
  const [clientMessage, setClientMessage] = useState('');
  const [editingClientId, setEditingClientId] = useState('');
  const [editingClientForm, setEditingClientForm] = useState({ client_name: '', company_name: '', phone: '', email: '' });

  async function parseApiError(response: Response, fallback: string) {
    const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function load() {
    if (!organizationId) {
      setClients([]);
      return;
    }

    const response = await fetch(`/api/clients?organization_id=${organizationId}`);
    const data = await response.json();
    setClients(Array.isArray(data) ? data : []);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [organizationId]);

  async function createClient(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setClientMessage('');

    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        organization_id: organizationId,
        phone: form.phone || null,
        email: form.email || null
      })
    });

    if (!response.ok) {
      setClientMessage(await parseApiError(response, t('client_create_failed')));
      return;
    }

    setForm({ client_name: '', company_name: '', phone: '', email: '' });
    setClientMessage(t('client_created'));
    await load();
  }

  function startEditClient(client: Client) {
    setEditingClientId(client.id);
    setEditingClientForm({
      client_name: client.client_name,
      company_name: client.company_name,
      phone: client.phone ?? '',
      email: client.email ?? ''
    });
    setClientMessage('');
  }

  async function updateClient(id: string) {
    const response = await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: editingClientForm.client_name.trim(),
        company_name: editingClientForm.company_name.trim(),
        phone: editingClientForm.phone.trim() || null,
        email: editingClientForm.email.trim() || null
      })
    });

    if (!response.ok) {
      setClientMessage(await parseApiError(response, t('client_update_failed')));
      return;
    }

    setEditingClientId('');
    setClientMessage(t('client_updated'));
    await load();
  }

  async function removeClient(id: string) {
    const response = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      setClientMessage(await parseApiError(response, t('client_delete_failed')));
      return;
    }
    if (editingClientId === id) setEditingClientId('');
    setClientMessage(t('client_deleted'));
    await load();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('clients')}</h1>

      <div className="surface space-y-3 p-4">
        <h2 className="text-lg font-semibold">{t('client_management')}</h2>
        <form onSubmit={createClient} className="grid gap-2 md:grid-cols-5">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('client_name')}</span>
            <input
              placeholder={t('client_name')}
              value={form.client_name}
              onChange={(e) => setForm((prev) => ({ ...prev, client_name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('company_name')}</span>
            <input
              placeholder={t('company_name')}
              value={form.company_name}
              onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('phone_optional')}</span>
            <input
              placeholder={t('phone_optional')}
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('email_optional')}</span>
            <input
              placeholder={t('email_optional')}
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>
          <button
            type="submit"
            className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            disabled={!organizationId}
          >
            {t('add_client')}
          </button>
        </form>
        {clientMessage ? <p className="text-sm text-slate-600">{clientMessage}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-3 py-2 text-left">{t('client')}</th>
                <th className="px-3 py-2 text-left">{t('company_name')}</th>
                <th className="px-3 py-2 text-left">{t('phone')}</th>
                <th className="px-3 py-2 text-left">{t('email')}</th>
                <th className="px-3 py-2 text-left">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const isEditing = editingClientId === client.id;
                return (
                  <tr key={client.id} className="border-t border-slate-200/70">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingClientForm.client_name}
                          onChange={(e) => setEditingClientForm((prev) => ({ ...prev, client_name: e.target.value }))}
                          required
                        />
                      ) : (
                        client.client_name
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingClientForm.company_name}
                          onChange={(e) =>
                            setEditingClientForm((prev) => ({ ...prev, company_name: e.target.value }))
                          }
                          required
                        />
                      ) : (
                        client.company_name
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editingClientForm.phone}
                          onChange={(e) => setEditingClientForm((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                      ) : (
                        client.phone ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editingClientForm.email}
                          onChange={(e) => setEditingClientForm((prev) => ({ ...prev, email: e.target.value }))}
                        />
                      ) : (
                        client.email ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                              onClick={() => void updateClient(client.id)}
                            >
                              {t('save')}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                              onClick={() => setEditingClientId('')}
                            >
                              {t('cancel')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                            onClick={() => startEditClient(client)}
                          >
                            {t('edit')}
                          </button>
                        )}
                        <button
                          onClick={() => void removeClient(client.id)}
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
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
