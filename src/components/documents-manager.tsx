'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { useActiveOrganization } from '@/components/org-selector';

interface Client {
  id: string;
  client_name: string;
  company_name: string;
}

interface DocumentRow {
  id: string;
  number: string;
  type: 'quotation' | 'invoice' | 'receipt';
  issue_date: string;
  due_date: string | null;
  currency: string;
  total_amount: number;
  clients: Client;
}

interface ItemForm {
  description: string;
  quantity: number;
  unit_price: number;
}

interface NoteTemplate {
  id: string;
  name: string;
  content: string;
}

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

interface DocumentsListResponse {
  data: DocumentRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface OrganizationSettingsResponse {
  default_currency?: string | null;
}

export function DocumentsManager() {
  const router = useRouter();
  const { organizationId } = useActiveOrganization();
  const { t } = useI18n();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([]);
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [selectedLineItemTemplateId, setSelectedLineItemTemplateId] = useState('');
  const [lineItemTemplateName, setLineItemTemplateName] = useState('');
  const [lineItemTemplateDraft, setLineItemTemplateDraft] = useState({
    description: '',
    quantity: 1,
    unit_price: 0,
    currency: 'USD'
  });
  const [lineItemTemplateMessage, setLineItemTemplateMessage] = useState('');
  const [showLineItemTemplatePanel, setShowLineItemTemplatePanel] = useState(false);
  const [showClientCreator, setShowClientCreator] = useState(false);
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [savingNoteTemplate, setSavingNoteTemplate] = useState(false);
  const [savingLineTemplate, setSavingLineTemplate] = useState(false);
  const [convertingDocumentId, setConvertingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState('');
  const [clientDraft, setClientDraft] = useState({
    client_name: '',
    company_name: '',
    phone: '',
    email: ''
  });
  const [typeFilter, setTypeFilter] = useState<'all' | 'quotation' | 'invoice' | 'receipt'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState({
    client_id: '',
    number: '',
    type: 'quotation' as 'quotation' | 'invoice' | 'receipt',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    currency: 'USD',
    tax_percentage: 0,
    notes: ''
  });
  const [items, setItems] = useState<ItemForm[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const loadRequestRef = useRef(0);

  async function load() {
    const requestId = ++loadRequestRef.current;

    if (!organizationId) {
      const [templateRes, lineItemTemplateRes] = await Promise.all([
        fetch('/api/document-note-templates'),
        fetch('/api/line-item-templates')
      ]);
      const [templateData, lineItemTemplateData] = await Promise.all([templateRes.json(), lineItemTemplateRes.json()]);
      if (requestId !== loadRequestRef.current) return;
      if (!templateRes.ok) {
        setTemplateMessage(
          typeof templateData?.error === 'string' ? templateData.error : t('template_save_failed')
        );
      }
      if (!lineItemTemplateRes.ok) {
        setLineItemTemplateMessage(
          typeof lineItemTemplateData?.error === 'string'
            ? lineItemTemplateData.error
            : t('line_item_template_save_failed')
        );
      }
      setDocuments([]);
      setPage(1);
      setTotalPages(1);
      setClients([]);
      setNoteTemplates(Array.isArray(templateData) ? templateData : []);
      setLineItemTemplates(Array.isArray(lineItemTemplateData) ? lineItemTemplateData : []);
      return;
    }

    const typeQuery = typeFilter === 'all' ? '' : `&type=${typeFilter}`;
    const [docRes, clientRes, templateRes, lineItemTemplateRes] = await Promise.all([
      fetch(
        `/api/documents?organization_id=${organizationId}${typeQuery}&q=${encodeURIComponent(searchQuery)}&page=${page}&page_size=10`
      ),
      fetch(`/api/clients?organization_id=${organizationId}`),
      fetch(`/api/document-note-templates?organization_id=${organizationId}`),
      fetch(`/api/line-item-templates?organization_id=${organizationId}`)
    ]);

    const [docData, clientData, templateData, lineItemTemplateData] = await Promise.all([
      docRes.json(),
      clientRes.json(),
      templateRes.json(),
      lineItemTemplateRes.json()
    ]);
    if (requestId !== loadRequestRef.current) return;
    if (!templateRes.ok) {
      setTemplateMessage(typeof templateData?.error === 'string' ? templateData.error : t('template_save_failed'));
    }
    if (!lineItemTemplateRes.ok) {
      setLineItemTemplateMessage(
        typeof lineItemTemplateData?.error === 'string'
          ? lineItemTemplateData.error
          : t('line_item_template_save_failed')
      );
    }
    const docsPayload = (docData ?? {}) as Partial<DocumentsListResponse>;
    setDocuments(Array.isArray(docsPayload.data) ? docsPayload.data : []);
    setTotalPages(Number(docsPayload.total_pages ?? 1) || 1);
    if (typeof docsPayload.page === 'number' && docsPayload.page !== page) {
      setPage(docsPayload.page);
    }
    setClients(Array.isArray(clientData) ? clientData : []);
    setNoteTemplates(Array.isArray(templateData) ? templateData : []);
    setLineItemTemplates(Array.isArray(lineItemTemplateData) ? lineItemTemplateData : []);
    if (!form.client_id && Array.isArray(clientData) && clientData[0]) {
      setForm((prev) => ({ ...prev, client_id: clientData[0].id }));
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [organizationId, typeFilter, searchQuery, page]);

  useEffect(() => {
    async function loadDefaultCurrency() {
      if (!organizationId) return;

      const response = await fetch(`/api/organizations/${organizationId}`);
      const data = (await response.json().catch(() => null)) as OrganizationSettingsResponse | null;
      if (!response.ok) return;

      const nextCurrency = data?.default_currency?.trim().toUpperCase() || 'USD';
      setForm((prev) => ({ ...prev, currency: nextCurrency }));
      setLineItemTemplateDraft((prev) => ({ ...prev, currency: nextCurrency }));
    }

    void loadDefaultCurrency();
  }, [organizationId]);

  const previewTotal = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const tax = subtotal * (form.tax_percentage / 100);
    return (subtotal + tax).toFixed(2);
  }, [items, form.tax_percentage]);

  function updateItem(index: number, key: keyof ItemForm, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [key]: key === 'description' ? value : Number(value)
      };
      return next;
    });
  }

  async function createDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId || !form.client_id || creatingDocument) return;

    setCreatingDocument(true);
    setActionMessage('');
    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        client_id: form.client_id,
        number: form.number.trim() || null,
        type: form.type,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        currency: form.currency.trim() || 'USD',
        tax_percentage: Number(form.tax_percentage),
        notes: form.notes || null,
        items
      })
    });
    setCreatingDocument(false);

    const data = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!response.ok) {
      setActionMessage(typeof data?.error === 'string' ? data.error : t('create_document_failed'));
      return;
    }

    if (typeof data?.id === 'string') {
      router.push(`/documents/${data.id}`);
      router.refresh();
      return;
    }

    await load();
  }

  async function convert(id: string, type: DocumentRow['type']) {
    if (type !== 'quotation' || convertingDocumentId) return;

    setConvertingDocumentId(id);
    const response = await fetch(`/api/documents/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setActionMessage(typeof data?.error === 'string' ? data.error : t('convert_failed'));
      setConvertingDocumentId(null);
      return;
    }
    const data = (await response.json()) as { id?: string };
    if (typeof data.id === 'string') {
      router.push(`/documents/${data.id}`);
      router.refresh();
      return;
    }
    setActionMessage('');
    setConvertingDocumentId(null);
    await load();
  }

  async function removeDocument(id: string) {
    if (deletingDocumentId) return;
    const confirmed = window.confirm(t('delete_document_confirm'));
    if (!confirmed) return;

    setDeletingDocumentId(id);
    const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setActionMessage(typeof data?.error === 'string' ? data.error : t('delete_document_failed'));
      setDeletingDocumentId(null);
      return;
    }

    setActionMessage(t('delete_document_success'));
    setDeletingDocumentId(null);
    await load();
  }

  async function saveTemplate() {
    if (!organizationId) {
      setTemplateMessage(t('workspace_required_for_save'));
      return;
    }
    if (!templateName.trim()) {
      setTemplateMessage(t('template_name_required'));
      return;
    }
    if (!form.notes.trim()) {
      setTemplateMessage(t('note_template_requires_notes'));
      return;
    }

    if (savingNoteTemplate) return;
    setSavingNoteTemplate(true);
    const response = await fetch('/api/document-note-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        name: templateName.trim(),
        content: form.notes
      })
    });
    setSavingNoteTemplate(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      const errorText = typeof data?.error === 'string' ? data.error : t('template_save_failed');
      setTemplateMessage(errorText);
      return;
    }

    const savedTemplate = (await response.json()) as NoteTemplate;
    setNoteTemplates((prev) => {
      const next = prev.filter((template) => template.id !== savedTemplate.id);
      return [...next, savedTemplate].sort((a, b) => a.name.localeCompare(b.name));
    });
    setTemplateName('');
    setSelectedTemplateId(savedTemplate.id);
    setTemplateMessage(t('template_saved'));
  }

  async function saveLineItemTemplate() {
    if (!organizationId) {
      setLineItemTemplateMessage(t('workspace_required_for_save'));
      return;
    }
    if (!lineItemTemplateName.trim()) {
      setLineItemTemplateMessage(t('template_name_required'));
      return;
    }

    if (!lineItemTemplateDraft.description.trim()) {
      setLineItemTemplateMessage(t('line_item_template_requires_item'));
      return;
    }

    if (savingLineTemplate) return;
    setSavingLineTemplate(true);
    const response = await fetch('/api/line-item-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        name: lineItemTemplateName.trim(),
        description: lineItemTemplateDraft.description.trim(),
        quantity: Number(lineItemTemplateDraft.quantity),
        unit_price: Number(lineItemTemplateDraft.unit_price),
        currency: lineItemTemplateDraft.currency.trim().toUpperCase() || form.currency.trim().toUpperCase() || 'USD'
      })
    });
    setSavingLineTemplate(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      const errorText = typeof data?.error === 'string' ? data.error : t('line_item_template_save_failed');
      setLineItemTemplateMessage(errorText);
      return;
    }

    const savedTemplate = (await response.json()) as LineItemTemplate;
    setLineItemTemplates((prev) => {
      const next = prev.filter((template) => template.id !== savedTemplate.id);
      return [...next, savedTemplate].sort((a, b) => a.name.localeCompare(b.name));
    });
    setLineItemTemplateName('');
    setLineItemTemplateDraft({
      description: '',
      quantity: 1,
      unit_price: 0,
      currency: form.currency.trim().toUpperCase() || 'USD'
    });
    setSelectedLineItemTemplateId(savedTemplate.id);
    setLineItemTemplateMessage(t('line_item_template_saved'));
  }

  function addItemFromTemplateDraft() {
    const selectedTemplate = lineItemTemplates.find((template) => template.id === selectedLineItemTemplateId);
    const description = selectedTemplate?.description ?? lineItemTemplateDraft.description;
    const quantity = selectedTemplate ? Number(selectedTemplate.quantity) : Number(lineItemTemplateDraft.quantity);
    const unitPrice = selectedTemplate ? Number(selectedTemplate.unit_price) : Number(lineItemTemplateDraft.unit_price);

    if (!description.trim()) {
      setLineItemTemplateMessage(t('line_item_template_requires_item'));
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        description: description.trim(),
        quantity,
        unit_price: unitPrice
      }
    ]);
    setLineItemTemplateMessage('');
  }

  async function createClientAndSelect() {
    if (!organizationId || !clientDraft.client_name.trim() || !clientDraft.company_name.trim() || creatingClient) return;

    setCreatingClient(true);
    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        client_name: clientDraft.client_name.trim(),
        company_name: clientDraft.company_name.trim(),
        phone: clientDraft.phone.trim() || null,
        email: clientDraft.email.trim() || null
      })
    });

    const data = await response.json();
    setCreatingClient(false);
    if (!response.ok) {
      setClientMessage(data.error ?? t('client_create_failed'));
      return;
    }

    const created = data as Client;
    setClients((prev) => [created, ...prev]);
    setForm((prev) => ({ ...prev, client_id: created.id }));
    setClientDraft({ client_name: '', company_name: '', phone: '', email: '' });
    setShowClientCreator(false);
    setClientMessage(t('client_created'));
  }

  function typeLabel(value: string) {
    if (value === 'quotation') return t('quotation');
    if (value === 'invoice') return t('invoice');
    if (value === 'receipt') return t('receipt');
    return value;
  }

  function convertLabel(type: DocumentRow['type']) {
    if (type === 'quotation') return t('convert_to_invoice');
    return t('convert');
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('documents')}</h1>
      </div>

      <form onSubmit={createDocument} className="surface space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('client')}</span>
            <select
              value={form.client_id}
              onChange={(e) => {
                const value = e.target.value;
                setClientMessage('');
                if (value === '__add_client__') {
                  setShowClientCreator(true);
                  setForm((prev) => ({ ...prev, client_id: '' }));
                  return;
                }

                setShowClientCreator(false);
                setForm((prev) => ({ ...prev, client_id: value }));
              }}
              required
            >
              <option value="">{t('select_client')}</option>
              {clients.map((client) => (
                <option value={client.id} key={client.id}>
                  {client.client_name} ({client.company_name})
                </option>
              ))}
              <option value="__add_client__">{t('add_client_option')}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('number')}</span>
            <input
              value={form.number}
              onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
              placeholder={t('number')}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('type')}</span>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as typeof form.type }))}
            >
              <option value="quotation">{t('quotation')}</option>
              <option value="invoice">{t('invoice')}</option>
              <option value="receipt">{t('receipt')}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('issue')}</span>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('due')}</span>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('tax_percent')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.tax_percentage}
              onChange={(e) => setForm((prev) => ({ ...prev, tax_percentage: Number(e.target.value) }))}
              placeholder={t('tax_percent')}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('currency')}</span>
            <input
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
              placeholder="USD"
            />
          </label>
        </div>

        {showClientCreator ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('client_name')}</span>
                <input
                  placeholder={t('client_name')}
                  value={clientDraft.client_name}
                  onChange={(e) => setClientDraft((prev) => ({ ...prev, client_name: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('company_name')}</span>
                <input
                  placeholder={t('company_name')}
                  value={clientDraft.company_name}
                  onChange={(e) => setClientDraft((prev) => ({ ...prev, company_name: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('phone_optional')}</span>
                <input
                  placeholder={t('phone_optional')}
                  value={clientDraft.phone}
                  onChange={(e) => setClientDraft((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('email_optional')}</span>
                <input
                  placeholder={t('email_optional')}
                  type="email"
                  value={clientDraft.email}
                  onChange={(e) => setClientDraft((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                onClick={() => void createClientAndSelect()}
                disabled={!clientDraft.client_name.trim() || !clientDraft.company_name.trim() || !organizationId || creatingClient}
              >
                <span className="loading-inline">
                  {creatingClient ? <span className="loading-spinner" aria-hidden="true" /> : null}
                  {creatingClient ? t('please_wait') : t('create_and_select_client')}
                </span>
              </button>
              {clientMessage ? <p className="text-sm text-slate-600">{clientMessage}</p> : null}
            </div>
          </div>
        ) : null}

        <p className="text-sm font-semibold text-slate-700">{t('notes_template')}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('select_notes_template')}</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                const nextId = e.target.value;
                setTemplateMessage('');
                if (nextId === '__add_template__') {
                  setSelectedTemplateId('');
                  setTemplateName(t('new_note_template'));
                  setTemplateMessage(t('new_note_template'));
                  return;
                }
                setSelectedTemplateId(nextId);
                const template = noteTemplates.find((item) => item.id === nextId);
                if (template) {
                  setForm((prev) => ({ ...prev, notes: template.content }));
                }
              }}
            >
              <option value="">{t('select_notes_template')}</option>
              {noteTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
              <option value="__add_template__">{t('add_template_option')}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('template_name')}</span>
            <input
              placeholder={t('template_name')}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            onClick={() => void saveTemplate()}
            disabled={savingNoteTemplate}
          >
            <span className="loading-inline">
              {savingNoteTemplate ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {savingNoteTemplate ? t('please_wait') : t('save_template')}
            </span>
          </button>
        </div>
        {templateMessage ? <p className="text-sm text-slate-600">{templateMessage}</p> : null}

        <label className="space-y-1 text-sm text-slate-700">
          <span>{t('notes')}</span>
          <textarea
            placeholder={t('notes')}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </label>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">{t('line_item_template')}</p>
            <button
              type="button"
              className="h-[42px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
              onClick={() => setShowLineItemTemplatePanel((prev) => !prev)}
              aria-expanded={showLineItemTemplatePanel}
            >
              {showLineItemTemplatePanel ? t('hide') : t('show')}
            </button>
          </div>
          {showLineItemTemplatePanel ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t('select_line_item_template')}</span>
                  <select
                    value={selectedLineItemTemplateId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLineItemTemplateMessage('');
                      if (value === '__add_line_item_template__') {
                        const source = items.find((item) => item.description.trim()) ?? items[0];
                        setSelectedLineItemTemplateId('');
                        setLineItemTemplateName(t('new_line_item_template'));
                        setLineItemTemplateDraft({
                          description: source?.description ?? '',
                          quantity: Number(source?.quantity ?? 1),
                          unit_price: Number(source?.unit_price ?? 0),
                          currency: form.currency
                        });
                        setLineItemTemplateMessage(t('new_line_item_template'));
                        return;
                      }

                      setSelectedLineItemTemplateId(value);
                      const template = lineItemTemplates.find((item) => item.id === value);
                      if (!template) return;
                      setLineItemTemplateDraft({
                        description: template.description,
                        quantity: Number(template.quantity),
                        unit_price: Number(template.unit_price),
                        currency: template.currency?.trim().toUpperCase() || form.currency
                      });
                    }}
                  >
                    <option value="">{t('select_line_item_template')}</option>
                    {lineItemTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.quantity} x {Number(template.unit_price).toFixed(2)}{' '}
                        {template.currency?.trim().toUpperCase() || form.currency})
                      </option>
                    ))}
                    <option value="__add_line_item_template__">{t('add_line_item_template_option')}</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t('template_name')}</span>
                  <input
                    placeholder={t('template_name')}
                    value={lineItemTemplateName}
                    onChange={(event) => setLineItemTemplateName(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => addItemFromTemplateDraft()}
                >
                  {t('add_line_item')}
                </button>
                <button
                  type="button"
                  className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                  onClick={() => void saveLineItemTemplate()}
                  disabled={savingLineTemplate}
                >
                  <span className="loading-inline">
                    {savingLineTemplate ? <span className="loading-spinner" aria-hidden="true" /> : null}
                    {savingLineTemplate ? t('please_wait') : t('save_template')}
                  </span>
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t('description')}</span>
                  <input
                    value={lineItemTemplateDraft.description}
                    onChange={(event) =>
                      setLineItemTemplateDraft((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder={t('description')}
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t('quantity')}</span>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={lineItemTemplateDraft.quantity}
                    onChange={(event) =>
                      setLineItemTemplateDraft((prev) => ({ ...prev, quantity: Number(event.target.value || '0') }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t('unit_price')}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={lineItemTemplateDraft.unit_price}
                    onChange={(event) =>
                      setLineItemTemplateDraft((prev) => ({ ...prev, unit_price: Number(event.target.value || '0') }))
                    }
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span>{t('currency')}</span>
                  <input
                    value={lineItemTemplateDraft.currency}
                    onChange={(event) =>
                      setLineItemTemplateDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                    }
                    placeholder={form.currency}
                  />
                </label>
              </div>
              {lineItemTemplateMessage ? <p className="text-sm text-slate-600">{lineItemTemplateMessage}</p> : null}
            </div>
          ) : null}

          {items.map((item, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('description')}</span>
                <input
                  placeholder={t('description')}
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
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
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
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
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                  required
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('currency')}</span>
                <input
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                />
              </label>
              <button
                type="button"
                className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                onClick={() => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                disabled={items.length === 1}
              >
                {t('remove')}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            onClick={() => setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }])}
          >
            {t('add_line_item')}
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {t('preview_total')}: {form.currency} {previewTotal}
          </p>
          <button type="submit" disabled={!organizationId || creatingDocument}>
            <span className="loading-inline">
              {creatingDocument ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {creatingDocument ? t('please_wait') : t('create_document')}
            </span>
          </button>
        </div>
      </form>

      <div className="surface p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('search')}</span>
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('search_documents')}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('type')}</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as typeof typeFilter);
                setPage(1);
              }}
            >
              <option value="all">{t('all')}</option>
              <option value="quotation">{t('quotation')}</option>
              <option value="invoice">{t('invoice')}</option>
              <option value="receipt">{t('receipt')}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="surface overflow-x-auto">
        {actionMessage ? <p className="px-3 py-2 text-sm text-slate-600">{actionMessage}</p> : null}
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/80">
            <tr>
              <th className="px-3 py-2 text-left">{t('number')}</th>
              <th className="px-3 py-2 text-left">{t('type')}</th>
              <th className="px-3 py-2 text-left">{t('client')}</th>
              <th className="px-3 py-2 text-left">{t('issue')}</th>
              <th className="px-3 py-2 text-left">{t('due')}</th>
              <th className="px-3 py-2 text-left">{t('currency')}</th>
              <th className="px-3 py-2 text-left">{t('total')}</th>
              <th className="px-3 py-2 text-left">{t('action')}</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr className="border-t border-slate-200/70" key={document.id}>
                <td className="px-3 py-2">{document.number}</td>
                <td className="px-3 py-2">{typeLabel(document.type)}</td>
                <td className="px-3 py-2">{document.clients?.client_name}</td>
                <td className="px-3 py-2">{document.issue_date}</td>
                <td className="px-3 py-2">{document.due_date ?? '-'}</td>
                <td className="px-3 py-2">{document.currency}</td>
                <td className="px-3 py-2">
                  {document.currency} {document.total_amount.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                      href={`/documents/${document.id}`}
                    >
                      {t('open')}
                    </Link>
                    <a
                      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                      href={`/api/documents/${document.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('preview_pdf')}
                    </a>
                    {document.type === 'quotation' ? (
                      <button
                        type="button"
                        className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                        onClick={() => void convert(document.id, document.type)}
                        disabled={convertingDocumentId === document.id}
                      >
                        <span className="loading-inline">
                          {convertingDocumentId === document.id ? <span className="loading-spinner" aria-hidden="true" /> : null}
                          {convertingDocumentId === document.id ? t('please_wait') : convertLabel(document.type)}
                        </span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                      onClick={() => void removeDocument(document.id)}
                      disabled={deletingDocumentId === document.id}
                    >
                      <span className="loading-inline">
                        {deletingDocumentId === document.id ? <span className="loading-spinner" aria-hidden="true" /> : null}
                        {deletingDocumentId === document.id ? t('please_wait') : t('delete')}
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-end gap-2 px-3 py-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
          >
            {t('previous')}
          </button>
          <p className="text-sm text-slate-600">
            {t('page')} {page} / {Math.max(1, totalPages)}
          </p>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
          >
            {t('next')}
          </button>
        </div>
      </div>
    </section>
  );
}
