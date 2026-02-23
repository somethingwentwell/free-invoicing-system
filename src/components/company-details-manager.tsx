'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface WorkspaceSettings {
  id: string;
  name: string;
  logo_url: string | null;
  company_name: string | null;
  company_email: string | null;
  company_address: string | null;
  default_currency: string | null;
}

interface WorkspaceSettingsForm {
  logo_url: string;
  company_name: string;
  company_email: string;
  company_address: string;
  default_currency: string;
}

const EMPTY_FORM: WorkspaceSettingsForm = {
  logo_url: '',
  company_name: '',
  company_email: '',
  company_address: '',
  default_currency: 'USD'
};

export function CompanyDetailsManager() {
  const { organizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [form, setForm] = useState<WorkspaceSettingsForm>(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadWorkspace() {
      if (!organizationId) {
        setWorkspace(null);
        setForm(EMPTY_FORM);
        return;
      }

      const response = await fetch(`/api/organizations/${organizationId}`);
      const data = await response.json();

      if (!response.ok || !data) {
        setWorkspace(null);
        setForm(EMPTY_FORM);
        return;
      }

      const next = data as WorkspaceSettings;
      setWorkspace(next);
      setForm({
        logo_url: next.logo_url ?? '',
        company_name: next.company_name ?? '',
        company_email: next.company_email ?? '',
        company_address: next.company_address ?? '',
        default_currency: next.default_currency ?? 'USD'
      });
    }

    void loadWorkspace();
  }, [organizationId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;

    setSaving(true);
    setMessage('');

    const response = await fetch(`/api/organizations/${organizationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error ?? t('workspace_settings_save_failed'));
      return;
    }

    const updated = data as WorkspaceSettings;
    setWorkspace(updated);
    setForm({
      logo_url: updated.logo_url ?? '',
      company_name: updated.company_name ?? '',
      company_email: updated.company_email ?? '',
      company_address: updated.company_address ?? '',
      default_currency: updated.default_currency ?? 'USD'
    });
    setMessage(t('workspace_settings_saved'));
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('company_details')}</h1>

      <div className="surface p-4">
        <form onSubmit={save} className="grid gap-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('workspace_logo_url_optional')}</span>
            <input
              type="url"
              placeholder={t('workspace_logo_url_optional')}
              value={form.logo_url}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('company_name')}</span>
            <input
              placeholder={workspace?.name ?? t('company_name')}
              value={form.company_name}
              onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('email_optional')}</span>
            <input
              type="email"
              placeholder={t('email_optional')}
              value={form.company_email}
              onChange={(e) => setForm((prev) => ({ ...prev, company_email: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('workspace_address_optional')}</span>
            <textarea
              className="min-h-24"
              placeholder={t('workspace_address_optional')}
              value={form.company_address}
              onChange={(e) => setForm((prev) => ({ ...prev, company_address: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('default_currency')}</span>
            <input
              placeholder="USD"
              maxLength={6}
              value={form.default_currency}
              onChange={(e) => setForm((prev) => ({ ...prev, default_currency: e.target.value.toUpperCase() }))}
            />
          </label>

          <button type="submit" className="w-full sm:w-auto" disabled={!organizationId || saving}>
            {saving ? t('please_wait') : t('save_workspace_settings')}
          </button>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </form>
      </div>
    </section>
  );
}
