'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface Doc {
  id: string;
  status: string;
  total_amount: number;
  type: 'quotation' | 'invoice' | 'receipt';
  parent_document_id?: string | null;
  payment_group_invoice_id?: string | null;
}

interface DocumentsListResponse {
  data: Doc[];
}

interface Member {
  id: string;
  role: 'owner' | 'member';
  user_id: string;
  email: string | null;
  is_current_user?: boolean;
}

interface WorkspaceSettings {
  id: string;
  name: string;
  logo_url: string | null;
  company_name: string | null;
  company_email: string | null;
  company_address: string | null;
}

interface WorkspaceSettingsForm {
  logo_url: string;
  company_name: string;
  company_email: string;
  company_address: string;
}

const EMPTY_SETTINGS_FORM: WorkspaceSettingsForm = {
  logo_url: '',
  company_name: '',
  company_email: '',
  company_address: ''
};

export function DashboardOverview() {
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceSettingsForm>(EMPTY_SETTINGS_FORM);
  const [invite, setInvite] = useState({ email: '', role: 'member' as 'owner' | 'member' });
  const [memberMessage, setMemberMessage] = useState('');
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [showDeleteWorkspaceWarning, setShowDeleteWorkspaceWarning] = useState(false);

  async function load() {
    if (!organizationId) return;
    const [docRes, memberRes, orgRes] = await Promise.all([
      fetch(`/api/documents?organization_id=${organizationId}&page=1&page_size=1000`),
      fetch(`/api/organizations/${organizationId}/members`),
      fetch(`/api/organizations/${organizationId}`)
    ]);

    const [docData, memberData, orgData] = await Promise.all([docRes.json(), memberRes.json(), orgRes.json()]);
    const docsPayload = (docData ?? {}) as Partial<DocumentsListResponse>;
    setDocuments(Array.isArray(docsPayload.data) ? docsPayload.data : []);
    setMembers(Array.isArray(memberData) ? memberData : []);

    if (orgRes.ok && orgData) {
      const nextWorkspace = orgData as WorkspaceSettings;
      setWorkspace(nextWorkspace);
      setWorkspaceForm({
        logo_url: nextWorkspace.logo_url ?? '',
        company_name: nextWorkspace.company_name ?? '',
        company_email: nextWorkspace.company_email ?? '',
        company_address: nextWorkspace.company_address ?? ''
      });
      return;
    }

    setWorkspace(null);
    setWorkspaceForm(EMPTY_SETTINGS_FORM);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [organizationId]);

  const totals = useMemo(() => {
    const invoices = documents.filter((doc) => doc.type === 'invoice');
    const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
    const receiptTotalByInvoiceId = new Map<string, number>();

    documents
      .filter((doc) => doc.type === 'receipt')
      .forEach((receipt) => {
        const linkedInvoiceId = receipt.payment_group_invoice_id ?? receipt.parent_document_id ?? null;
        if (!linkedInvoiceId || !invoiceIds.has(linkedInvoiceId)) return;
        const nextTotal =
          (receiptTotalByInvoiceId.get(linkedInvoiceId) ?? 0) + Number(receipt.total_amount ?? 0);
        receiptTotalByInvoiceId.set(linkedInvoiceId, nextTotal);
      });

    const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
    const paidAmount = invoices.reduce((sum, invoice) => {
      const invoiceTotal = Number(invoice.total_amount);
      const received = Number(receiptTotalByInvoiceId.get(invoice.id) ?? 0);
      return sum + Math.max(0, Math.min(invoiceTotal, received));
    }, 0);
    const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid').length;
    const outstanding = invoices.reduce((sum, invoice) => {
      const invoiceTotal = Number(invoice.total_amount);
      const received = Number(receiptTotalByInvoiceId.get(invoice.id) ?? 0);
      const remaining = Math.max(0, invoiceTotal - received);
      return sum + remaining;
    }, 0);

    return {
      invoices: invoices.length,
      totalInvoiced,
      paidAmount,
      paidInvoices,
      outstanding
    };
  }, [documents]);

  async function saveWorkspaceSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;

    setSavingWorkspace(true);
    setWorkspaceMessage('');

    const response = await fetch(`/api/organizations/${organizationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspaceForm)
    });

    const data = await response.json();
    setSavingWorkspace(false);

    if (!response.ok) {
      setWorkspaceMessage(data.error ?? t('workspace_settings_save_failed'));
      return;
    }

    const updated = data as WorkspaceSettings;
    setWorkspace(updated);
    setWorkspaceForm({
      logo_url: updated.logo_url ?? '',
      company_name: updated.company_name ?? '',
      company_email: updated.company_email ?? '',
      company_address: updated.company_address ?? ''
    });
    setWorkspaceMessage(t('workspace_settings_saved'));
  }

  async function deleteCurrentWorkspace() {
    if (!organizationId || deletingWorkspace) return;

    setDeletingWorkspace(true);
    setWorkspaceMessage('');

    const response = await fetch(`/api/organizations/${organizationId}`, { method: 'DELETE' });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setDeletingWorkspace(false);
      setWorkspaceMessage(
        typeof data?.error === 'string' ? data.error : t('workspace_delete_failed')
      );
      return;
    }

    const orgResponse = await fetch('/api/organizations');
    const orgData = await orgResponse.json().catch(() => []);
    const orgList = Array.isArray(orgData) ? orgData : [];
    const nextId =
      orgList.find((org: { id?: string }) => typeof org?.id === 'string')?.id ?? '';

    setOrganizationId(nextId);
    setDeletingWorkspace(false);
    setShowDeleteWorkspaceWarning(false);
    setWorkspaceMessage(t('workspace_deleted'));
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId) return;

    const response = await fetch(`/api/organizations/${organizationId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invite)
    });

    const data = await response.json();
    if (!response.ok) {
      setMemberMessage(data.error ?? t('member_add_failed'));
      return;
    }

    setInvite({ email: '', role: 'member' });
    setMemberMessage(t('member_added_success'));
    await load();
  }

  async function removeMember(memberId: string) {
    if (!organizationId || deletingMemberId) return;

    const confirmed = window.confirm(t('delete_member_confirm'));
    if (!confirmed) return;

    setDeletingMemberId(memberId);
    const response = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
      method: 'DELETE'
    });
    const data = await response.json().catch(() => null);
    setDeletingMemberId(null);

    if (!response.ok) {
      setMemberMessage(typeof data?.error === 'string' ? data.error : t('member_delete_failed'));
      return;
    }

    setMemberMessage(t('member_deleted'));
    await load();
  }

  const isCurrentUserOwner = members.some((member) => member.is_current_user && member.role === 'owner');

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('dashboard')}</h1>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="surface p-4">
          <p className="text-sm text-slate-600">{t('invoices')}</p>
          <p className="text-xl font-semibold">{totals.invoices}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-600">{t('total_invoiced')}</p>
          <p className="text-xl font-semibold">${totals.totalInvoiced.toFixed(2)}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-600">{t('paid_invoices')}</p>
          <p className="text-xl font-semibold">{totals.paidInvoices}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-600">{t('paid_amount')}</p>
          <p className="text-xl font-semibold">${totals.paidAmount.toFixed(2)}</p>
        </div>
        <div className="surface p-4">
          <p className="text-sm text-slate-600">{t('outstanding')}</p>
          <p className="text-xl font-semibold">${totals.outstanding.toFixed(2)}</p>
        </div>
      </div>

      <div className="surface p-4">
        <h2 className="mb-3 text-lg font-semibold">{t('workspace_settings')}</h2>

        <form onSubmit={saveWorkspaceSettings} className="grid gap-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('workspace_logo_url_optional')}</span>
            <input
              type="url"
              placeholder={t('workspace_logo_url_optional')}
              value={workspaceForm.logo_url}
              onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, logo_url: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('company_name')}</span>
            <input
              placeholder={workspace?.name ?? t('company_name')}
              value={workspaceForm.company_name}
              onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, company_name: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('email_optional')}</span>
            <input
              type="email"
              placeholder={t('email_optional')}
              value={workspaceForm.company_email}
              onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, company_email: e.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('workspace_address_optional')}</span>
            <textarea
              className="min-h-24"
              placeholder={t('workspace_address_optional')}
              value={workspaceForm.company_address}
              onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, company_address: e.target.value }))}
            />
          </label>

          <button type="submit" className="w-full sm:w-auto" disabled={!organizationId || savingWorkspace}>
            {savingWorkspace ? t('please_wait') : t('save_workspace_settings')}
          </button>
          <button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => setShowDeleteWorkspaceWarning(true)}
            disabled={!organizationId || deletingWorkspace}
          >
            {deletingWorkspace ? t('please_wait') : t('delete_workspace')}
          </button>
          {showDeleteWorkspaceWarning ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              <p>{t('delete_workspace_confirm')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => void deleteCurrentWorkspace()}
                  disabled={!organizationId || deletingWorkspace}
                >
                  {deletingWorkspace ? t('please_wait') : t('delete_workspace')}
                </button>
                <button
                  type="button"
                  className="h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => setShowDeleteWorkspaceWarning(false)}
                  disabled={deletingWorkspace}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : null}

          {workspaceMessage ? <p className="text-sm text-slate-600">{workspaceMessage}</p> : null}
        </form>
      </div>

      <div className="surface p-4">
        <h2 className="mb-3 text-lg font-semibold">{t('team_members')}</h2>
        <form onSubmit={inviteMember} className="mb-3 grid gap-2 md:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('user_email')}</span>
            <input
              type="email"
              placeholder={t('user_email')}
              value={invite.email}
              onChange={(e) => setInvite((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('role')}</span>
            <select
              value={invite.role}
              onChange={(e) => setInvite((prev) => ({ ...prev, role: e.target.value as 'owner' | 'member' }))}
            >
              <option value="member">{t('member')}</option>
              <option value="owner">{t('owner')}</option>
            </select>
          </label>
          <button
            type="submit"
            className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            disabled={!organizationId}
          >
            {t('add_member')}
          </button>
        </form>

        {memberMessage ? <p className="mb-2 text-sm text-slate-600">{memberMessage}</p> : null}

        <ul className="space-y-2 text-sm">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/80 p-2.5"
            >
              <span>
                {member.email ?? member.id} ({member.role === 'owner' ? t('owner') : t('member')})
              </span>
              {isCurrentUserOwner && member.role !== 'owner' && !member.is_current_user ? (
                <button
                  type="button"
                  className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => void removeMember(member.id)}
                  disabled={deletingMemberId === member.id}
                >
                  {deletingMemberId === member.id ? t('please_wait') : t('delete')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
