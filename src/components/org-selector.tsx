'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';

interface Org {
  id: string;
  name: string;
}

const STORAGE_KEY = 'active_org_id';
const ORG_CHANGED_EVENT = 'active-org-changed';

export function useActiveOrganization() {
  const [organizationId, setOrganizationId] = useState<string>('');

  useEffect(() => {
    const read = () => {
      const value = localStorage.getItem(STORAGE_KEY) ?? '';
      setOrganizationId(value);
    };

    const onCustomChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail ?? '';
      setOrganizationId(next);
    };

    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setOrganizationId(event.newValue ?? '');
    };

    read();
    window.addEventListener(ORG_CHANGED_EVENT, onCustomChange as EventListener);
    window.addEventListener('storage', onStorageChange);

    return () => {
      window.removeEventListener(ORG_CHANGED_EVENT, onCustomChange as EventListener);
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  function update(value: string) {
    localStorage.setItem(STORAGE_KEY, value);
    setOrganizationId(value);
    window.dispatchEvent(new CustomEvent<string>(ORG_CHANGED_EVENT, { detail: value }));
  }

  return { organizationId, setOrganizationId: update };
}

export function OrgSelector({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [localOrgs, setLocalOrgs] = useState<Org[]>(organizations);
  const [defaultOrganizationId, setDefaultOrganizationId] = useState<string>('');
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLocalOrgs(organizations);
  }, [organizations]);

  useEffect(() => {
    async function loadDefaultWorkspace() {
      const response = await fetch('/api/profiles/default-workspace');
      const data = await response.json();
      if (!response.ok) {
        setDefaultLoaded(true);
        return;
      }

      const defaultOrgId = typeof data?.default_organization_id === 'string' ? data.default_organization_id : '';
      setDefaultOrganizationId(defaultOrgId);
      setDefaultLoaded(true);
    }

    void loadDefaultWorkspace();
  }, []);

  useEffect(() => {
    if (!defaultLoaded || organizationId) return;

    const hasDefault = defaultOrganizationId && localOrgs.some((org) => org.id === defaultOrganizationId);
    if (hasDefault) {
      setOrganizationId(defaultOrganizationId);
      return;
    }

    if (localOrgs.length > 0) {
      setOrganizationId(localOrgs[0].id);
    }
  }, [defaultLoaded, defaultOrganizationId, organizationId, localOrgs, setOrganizationId]);

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    setMessage('');

    const response = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWorkspaceName.trim() })
    });

    const data = await response.json();
    setCreating(false);

    if (!response.ok) {
      setMessage(data.error ?? t('workspace_create_failed'));
      return;
    }

    const created = data as Org;
    setLocalOrgs((prev) => [...prev, created]);
    setOrganizationId(created.id);
    setNewWorkspaceName('');
    setMessage(t('workspace_created'));
    setShowCreator(false);
    router.refresh();
  }

  async function saveDefaultWorkspace() {
    if (!organizationId) return;
    setSavingDefault(true);
    setMessage('');

    const response = await fetch('/api/profiles/default-workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId })
    });

    const data = await response.json();
    setSavingDefault(false);

    if (!response.ok) {
      setMessage(data.error ?? t('default_workspace_save_failed'));
      return;
    }

    setDefaultOrganizationId(organizationId);
    setMessage(t('default_workspace_saved'));
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
        <select
          className="min-w-0 flex-1 bg-white"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          <option value="">{t('select_workspace')}</option>
          {localOrgs.map((org) => (
            <option value={org.id} key={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100 sm:w-auto"
          onClick={() => setShowCreator((prev) => !prev)}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
        onClick={() => void saveDefaultWorkspace()}
        disabled={!organizationId || savingDefault}
      >
        {savingDefault ? t('please_wait') : t('save_default_workspace')}
      </button>

      {showCreator ? (
        <div className="fixed inset-x-3 top-16 z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-12 sm:w-72">
          <div className="space-y-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('workspace_name')}</span>
              <input
                className="w-full bg-white"
                placeholder={t('workspace_name')}
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
              onClick={() => void createWorkspace()}
              disabled={creating || !newWorkspaceName.trim()}
            >
              {creating ? t('please_wait') : t('add_workspace')}
            </button>
            {message ? <p className="text-xs text-slate-600">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
