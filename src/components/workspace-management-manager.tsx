'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface Workspace {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

export function WorkspaceManagementManager() {
  const router = useRouter();
  const { t } = useI18n();
  const { organizationId, setOrganizationId } = useActiveOrganization();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const response = await fetch('/api/organizations');
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? t('workspace_load_failed'));
      return;
    }

    setWorkspaces(Array.isArray(data) ? data : []);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, []);

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault();
    if (!newWorkspaceName.trim() || creating) return;

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

    setNewWorkspaceName('');
    setMessage(t('workspace_created'));
    await load();
    router.refresh();
  }

  async function deleteWorkspace(id: string) {
    if (deletingId) return;

    const confirmed = window.confirm(t('delete_workspace_confirm'));
    if (!confirmed) return;

    setDeletingId(id);
    setMessage('');

    const response = await fetch(`/api/organizations/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (!response.ok) {
      setDeletingId(null);
      setMessage(data.error ?? t('workspace_delete_failed'));
      return;
    }

    const nextList = workspaces.filter((workspace) => workspace.id !== id);
    setWorkspaces(nextList);

    if (organizationId === id) {
      const nextActive = nextList[0]?.id ?? '';
      setOrganizationId(nextActive);
    }

    setDeletingId(null);
    setMessage(t('workspace_deleted'));
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('workspace_management')}</h1>

      <form onSubmit={createWorkspace} className="surface p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('workspace_name')}</span>
            <input
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              placeholder={t('workspace_name')}
            />
          </label>
          <button type="submit" disabled={creating || !newWorkspaceName.trim()}>
            <span className="loading-inline">
              {creating ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {creating ? t('please_wait') : t('add_workspace')}
            </span>
          </button>
        </div>
      </form>

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/80">
            <tr>
              <th className="px-3 py-2 text-left">{t('workspace_name')}</th>
              <th className="px-3 py-2 text-left">{t('role')}</th>
              <th className="px-3 py-2 text-left">{t('action')}</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => (
              <tr key={workspace.id} className="border-t border-slate-200/70">
                <td className="px-3 py-2">{workspace.name}</td>
                <td className="px-3 py-2">{workspace.role === 'owner' ? t('owner') : t('member')}</td>
                <td className="px-3 py-2">
                  {workspace.role === 'owner' ? (
                    <button
                      type="button"
                      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                      onClick={() => void deleteWorkspace(workspace.id)}
                      disabled={deletingId === workspace.id}
                    >
                      <span className="loading-inline">
                        {deletingId === workspace.id ? <span className="loading-spinner" aria-hidden="true" /> : null}
                        {deletingId === workspace.id ? t('please_wait') : t('delete')}
                      </span>
                    </button>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
