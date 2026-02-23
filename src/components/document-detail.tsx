'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';

interface Payment {
  id: string;
  amount: number;
  paid_on: string;
}

interface Phase {
  id: string;
  title: string;
  kind: 'percentage' | 'fixed';
  value: number;
  phase_amount: number;
  due_date: string | null;
  is_paid: boolean;
  payments: Payment[];
  receipts?: Array<{ id: string; number: string }>;
}

interface Item {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface EditableItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Detail {
  id: string;
  organization_id: string;
  number: string;
  type: 'quotation' | 'invoice' | 'receipt';
  status?: string;
  parent_document_id?: string | null;
  payment_group_invoice_id?: string | null;
  issue_date: string;
  due_date: string | null;
  currency: string;
  tax_percentage: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  clients: { client_name: string; company_name: string };
  items: Item[];
  phases: Phase[];
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

export function DocumentDetail({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([]);
  const [lineItemTemplates, setLineItemTemplates] = useState<LineItemTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedLineItemTemplateId, setSelectedLineItemTemplateId] = useState('');
  const [lineItemTemplateName, setLineItemTemplateName] = useState('');
  const [lineItemTemplateMessage, setLineItemTemplateMessage] = useState('');
  const [lineItemTemplateDraft, setLineItemTemplateDraft] = useState({
    description: '',
    quantity: 1,
    unit_price: 0,
    currency: 'USD'
  });
  const [notesDraft, setNotesDraft] = useState('');
  const [editDraft, setEditDraft] = useState({
    number: '',
    status: 'paid',
    issue_date: '',
    due_date: '',
    currency: 'USD',
    tax_percentage: 0,
    total_amount: 0
  });
  const [itemDrafts, setItemDrafts] = useState<EditableItem[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [convertingDocument, setConvertingDocument] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingLineItemTemplate, setSavingLineItemTemplate] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState('');
  const [convertingPhaseId, setConvertingPhaseId] = useState<string | null>(null);
  const [deletingPhaseId, setDeletingPhaseId] = useState<string | null>(null);
  const [openingPhaseId, setOpeningPhaseId] = useState<string | null>(null);
  const [phaseForm, setPhaseForm] = useState({ title: '', kind: 'percentage', value: 0, due_date: '' });

  function typeLabel(value: string) {
    if (value === 'quotation') return t('quotation');
    if (value === 'invoice') return t('invoice');
    if (value === 'receipt') return t('receipt');
    return value;
  }

  function convertLabel(type: Detail['type']) {
    if (type === 'quotation') return t('convert_to_invoice');
    return t('convert');
  }

  async function load() {
    const response = await fetch(`/api/documents/${id}`);
    const data = await response.json();
    setDetail(data);
    setNotesDraft(data.notes ?? '');
    setEditDraft({
      number: data.number ?? '',
      status: data.status ?? 'paid',
      issue_date: data.issue_date ?? '',
      due_date: data.due_date ?? '',
      currency: data.currency ?? 'USD',
      tax_percentage: Number(data.tax_percentage ?? 0),
      total_amount: Number(data.total_amount ?? 0)
    });
    setLineItemTemplateDraft((prev) => ({
      ...prev,
      currency: (data.currency ?? 'USD').toUpperCase()
    }));
    setItemDrafts(
      Array.isArray(data.items)
        ? data.items.map((item: Item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price)
          }))
        : []
    );

    if (data?.organization_id) {
      const [noteTemplateResponse, lineItemTemplateResponse] = await Promise.all([
        fetch(`/api/document-note-templates?organization_id=${data.organization_id}`),
        fetch(`/api/line-item-templates?organization_id=${data.organization_id}`)
      ]);
      const [noteTemplateData, lineItemTemplateData] = await Promise.all([
        noteTemplateResponse.json(),
        lineItemTemplateResponse.json()
      ]);
      setNoteTemplates(Array.isArray(noteTemplateData) ? noteTemplateData : []);
      setLineItemTemplates(Array.isArray(lineItemTemplateData) ? lineItemTemplateData : []);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [id]);

  async function convert() {
    if (convertingDocument) return;
    setConvertingDocument(true);
    const response = await fetch(`/api/documents/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setMessage(typeof data?.error === 'string' ? data.error : t('convert_failed'));
      setConvertingDocument(false);
      return;
    }
    const data = (await response.json()) as { id?: string };
    if (typeof data.id === 'string') {
      router.push(`/documents/${data.id}`);
      router.refresh();
      return;
    }
    setMessage('');
    setConvertingDocument(false);
    await load();
  }

  async function removeDocument() {
    if (deletingDocument) return;
    const confirmed = window.confirm(t('delete_document_confirm'));
    if (!confirmed) return;

    setDeletingDocument(true);
    const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setMessage(typeof data?.error === 'string' ? data.error : t('delete_document_failed'));
      setDeletingDocument(false);
      return;
    }

    router.push('/documents');
    router.refresh();
  }

  async function convertPhaseToReceipt(phaseId: string, remaining: number) {
    if (remaining <= 0) return;
    setPhaseMessage('');
    setConvertingPhaseId(phaseId);

    const response = await fetch(`/api/phases/${phaseId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: remaining,
        paid_on: new Date().toISOString().slice(0, 10),
        note: null
      })
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string; receipt?: { id?: string } }
      | null;

    if (!response.ok) {
      setPhaseMessage(typeof data?.error === 'string' ? data.error : t('convert_failed'));
      setConvertingPhaseId(null);
      return;
    }

    setConvertingPhaseId(null);
    await load();
  }

  async function deletePhase(phaseId: string) {
    if (deletingPhaseId) return;
    const confirmed = window.confirm(t('delete_document_confirm'));
    if (!confirmed) return;

    setDeletingPhaseId(phaseId);
    const response = await fetch(`/api/phases/${phaseId}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setPhaseMessage(typeof data?.error === 'string' ? data.error : t('delete_document_failed'));
      setDeletingPhaseId(null);
      return;
    }

    setDeletingPhaseId(null);
    await load();
  }

  async function openPhaseReceipt(phaseId: string) {
    if (openingPhaseId) return;
    setPhaseMessage('');
    setOpeningPhaseId(phaseId);

    const response = await fetch(`/api/phases/${phaseId}`);
    const data = (await response.json().catch(() => null)) as
      | { error?: string; receipt?: { id?: string } | null }
      | null;

    if (!response.ok) {
      setPhaseMessage(typeof data?.error === 'string' ? data.error : t('convert_failed'));
      setOpeningPhaseId(null);
      return;
    }

    const receiptId = data?.receipt?.id;
    if (typeof receiptId === 'string') {
      router.push(`/documents/${receiptId}`);
      router.refresh();
      return;
    }

    setPhaseMessage(t('convert_failed'));
    setOpeningPhaseId(null);
  }

  function updateItem(index: number, key: keyof EditableItem, value: string) {
    setItemDrafts((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [key]: key === 'description' ? value : Number(value)
      };
      return next;
    });
  }

  function addItemFromSelectedTemplate() {
    const selected = lineItemTemplates.find((template) => template.id === selectedLineItemTemplateId);
    if (!selected) return;

    setItemDrafts((prev) => [
      ...prev,
      {
        description: selected.description,
        quantity: Number(selected.quantity),
        unit_price: Number(selected.unit_price)
      }
    ]);
    setLineItemTemplateMessage('');
  }

  async function saveLineItemTemplate() {
    if (!detail || detail.type === 'receipt') return;
    if (!detail.organization_id) {
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
    if (savingLineItemTemplate) return;

    setSavingLineItemTemplate(true);
    const response = await fetch('/api/line-item-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: detail.organization_id,
        name: lineItemTemplateName.trim(),
        description: lineItemTemplateDraft.description.trim(),
        quantity: Number(lineItemTemplateDraft.quantity),
        unit_price: Number(lineItemTemplateDraft.unit_price),
        currency: lineItemTemplateDraft.currency.trim().toUpperCase() || editDraft.currency.trim().toUpperCase() || 'USD'
      })
    });
    setSavingLineItemTemplate(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setLineItemTemplateMessage(
        typeof data?.error === 'string' ? data.error : t('line_item_template_save_failed')
      );
      return;
    }

    const savedTemplate = (await response.json()) as LineItemTemplate;
    setLineItemTemplates((prev) => {
      const next = prev.filter((template) => template.id !== savedTemplate.id);
      return [...next, savedTemplate].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedLineItemTemplateId(savedTemplate.id);
    setLineItemTemplateName('');
    setLineItemTemplateDraft({
      description: savedTemplate.description,
      quantity: Number(savedTemplate.quantity),
      unit_price: Number(savedTemplate.unit_price),
      currency: savedTemplate.currency?.trim().toUpperCase() || editDraft.currency
    });
    setLineItemTemplateMessage(t('line_item_template_saved'));
  }

  async function saveDocumentDraft() {
    if (!detail || savingDraft) return;
    const receiptTotal = Number(editDraft.total_amount);
    const hasValidItems = itemDrafts.length > 0 && itemDrafts.every((item) => item.description.trim());
    const normalizedItems = hasValidItems ? itemDrafts : [];

    setSavingDraft(true);
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: editDraft.number.trim() || detail.number,
        ...(detail.type === 'receipt' ? { status: editDraft.status } : {}),
        issue_date: editDraft.issue_date,
        due_date: editDraft.due_date || null,
        currency: editDraft.currency.trim() || 'USD',
        tax_percentage: detail.type === 'receipt' ? 0 : Number(editDraft.tax_percentage),
        notes: notesDraft,
        ...(detail.type === 'receipt'
          ? {
              total_amount: Number.isFinite(receiptTotal) && receiptTotal >= 0 ? receiptTotal : 0
            }
          : normalizedItems.length > 0
            ? { items: normalizedItems }
            : {})
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      setMessage(typeof data?.error === 'string' ? data.error : t('notes_save_failed'));
      setSavingDraft(false);
      return;
    }

    setSavingDraft(false);
    setMessage(t('notes_saved'));
    await load();
  }

  async function addPhase(event: React.FormEvent) {
    event.preventDefault();
    if (addingPhase) return;
    setAddingPhase(true);
    await fetch(`/api/documents/${id}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: phaseForm.title,
        kind: phaseForm.kind,
        value: Number(phaseForm.value),
        due_date: phaseForm.due_date || null
      })
    });
    setAddingPhase(false);
    setPhaseForm({ title: '', kind: 'percentage', value: 0, due_date: '' });
    await load();
  }

  async function saveNotes() {
    if (!detail || savingNotes) return;

    setSavingNotes(true);
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesDraft })
    });

    if (!response.ok) {
      setMessage(t('notes_save_failed'));
      setSavingNotes(false);
      return;
    }

    setSavingNotes(false);
    setMessage(t('notes_saved'));
    await load();
  }

  async function saveTemplate() {
    if (!detail) return;
    if (!detail.organization_id) {
      setMessage(t('workspace_required_for_save'));
      return;
    }
    if (!templateName.trim()) {
      setMessage(t('template_name_required'));
      return;
    }
    if (!notesDraft.trim()) {
      setMessage(t('note_template_requires_notes'));
      return;
    }

    if (savingTemplate) return;
    setSavingTemplate(true);
    const response = await fetch('/api/document-note-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: detail.organization_id,
        name: templateName.trim(),
        content: notesDraft
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
      const errorText = typeof data?.error === 'string' ? data.error : t('template_save_failed');
      setMessage(errorText);
      setSavingTemplate(false);
      return;
    }

    const savedTemplate = (await response.json()) as NoteTemplate;
    setNoteTemplates((prev) => {
      const next = prev.filter((template) => template.id !== savedTemplate.id);
      return [...next, savedTemplate].sort((a, b) => a.name.localeCompare(b.name));
    });
    setTemplateName('');
    setSelectedTemplateId(savedTemplate.id);
    setSavingTemplate(false);
    setMessage(t('template_saved'));
  }

  if (!detail) return <p>{t('loading')}</p>;
  const backToQuotationHref =
    detail.type === 'invoice' && detail.parent_document_id ? `/documents/${detail.parent_document_id}` : null;
  const backToInvoiceId =
    detail.type === 'receipt' ? detail.payment_group_invoice_id || detail.parent_document_id || null : null;
  const backToInvoiceHref = backToInvoiceId ? `/documents/${backToInvoiceId}` : null;

  const paidAmount = detail.phases.reduce(
    (sum, phase) => sum + phase.payments.reduce((phaseTotal, payment) => phaseTotal + payment.amount, 0),
    0
  );

  return (
    <section className="space-y-4">
      <div>
        <Link
          href="/documents"
          className="inline-flex h-[42px] items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
        >
          {t('back_to_documents')}
        </Link>
      </div>

      <div className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {detail.number} ({typeLabel(detail.type)})
          </h1>
          <div className="flex gap-2">
            {detail.type === 'quotation' ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                onClick={() => void convert()}
                disabled={convertingDocument}
              >
                <span className="loading-inline">
                  {convertingDocument ? <span className="loading-spinner" aria-hidden="true" /> : null}
                  {convertingDocument ? t('please_wait') : convertLabel(detail.type)}
                </span>
              </button>
            ) : null}
            <a
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
              href={`/api/documents/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              {t('preview_pdf')}
            </a>
            <a
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              href={`/api/documents/${id}/pdf?download=1`}
            >
              {t('export_pdf')}
            </a>
            {backToQuotationHref ? (
              <Link
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                href={backToQuotationHref}
              >
                {t('back_to_quotation')}
              </Link>
            ) : null}
            {backToInvoiceHref ? (
              <Link
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                href={backToInvoiceHref}
              >
                {t('back_to_invoice')}
              </Link>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
              onClick={() => void removeDocument()}
              disabled={deletingDocument}
            >
              <span className="loading-inline">
                {deletingDocument ? <span className="loading-spinner" aria-hidden="true" /> : null}
                {deletingDocument ? t('please_wait') : t('delete')}
              </span>
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm">{t('client')}: {detail.clients.client_name}</p>
        <p className="text-sm">{t('company_name')}: {detail.clients.company_name}</p>
        <p className="text-sm">{t('issue')}: {detail.issue_date}</p>
        <p className="text-sm">{t('due')}: {detail.due_date ?? '-'}</p>
        <p className="text-sm">{t('tax')}: {detail.tax_percentage}%</p>
        <p className="text-sm">{t('subtotal')}: {detail.currency} {detail.subtotal.toFixed(2)}</p>
        <p className="text-sm">{t('total')}: {detail.currency} {detail.total_amount.toFixed(2)}</p>
      </div>

      <div className="surface p-4">
        <h2 className="mb-3 text-lg font-semibold">{t('edit')}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('number')}</span>
            <input
              value={editDraft.number}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, number: event.target.value }))}
            />
          </label>
          {detail.type === 'receipt' ? (
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('status')}</span>
              <select
                value={editDraft.status}
                onChange={(event) => setEditDraft((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="paid">{t('paid')}</option>
                <option value="draft">{t('draft')}</option>
              </select>
            </label>
          ) : null}
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('issue')}</span>
            <input
              type="date"
              value={editDraft.issue_date}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, issue_date: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('due')}</span>
            <input
              type="date"
              value={editDraft.due_date}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, due_date: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('currency')}</span>
            <input
              value={editDraft.currency}
              onChange={(event) =>
                setEditDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
              }
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('tax_percent')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={editDraft.tax_percentage}
              onChange={(event) =>
                setEditDraft((prev) => ({ ...prev, tax_percentage: Number(event.target.value || '0') }))
              }
            />
          </label>
          {detail.type === 'receipt' ? (
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('total')}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editDraft.total_amount}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, total_amount: Number(event.target.value || '0') }))
                }
              />
            </label>
          ) : null}
        </div>
        {detail.type !== 'receipt' ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('select_line_item_template')}</span>
                <select
                  value={selectedLineItemTemplateId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLineItemTemplateMessage('');
                    if (value === '__add_line_item_template__') {
                      const source = itemDrafts.find((item) => item.description.trim()) ?? itemDrafts[0];
                      setSelectedLineItemTemplateId('');
                      setLineItemTemplateName(t('new_line_item_template'));
                      setLineItemTemplateDraft({
                        description: source?.description ?? '',
                        quantity: Number(source?.quantity ?? 1),
                        unit_price: Number(source?.unit_price ?? 0),
                        currency: editDraft.currency
                      });
                      setLineItemTemplateMessage(t('new_line_item_template'));
                      return;
                    }

                    setSelectedLineItemTemplateId(value);
                    const selected = lineItemTemplates.find((template) => template.id === value);
                    if (selected) {
                      setLineItemTemplateDraft({
                        description: selected.description,
                        quantity: Number(selected.quantity),
                        unit_price: Number(selected.unit_price),
                        currency: selected.currency?.trim().toUpperCase() || editDraft.currency
                      });
                    }
                  }}
                >
                  <option value="">{t('select_line_item_template')}</option>
                  {lineItemTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.quantity} x {Number(template.unit_price).toFixed(2)}{' '}
                      {template.currency?.trim().toUpperCase() || editDraft.currency})
                    </option>
                  ))}
                  <option value="__add_line_item_template__">{t('add_line_item_template_option')}</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('template_name')}</span>
                <input
                  value={lineItemTemplateName}
                  placeholder={t('template_name')}
                  onChange={(event) => setLineItemTemplateName(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                onClick={() => addItemFromSelectedTemplate()}
                disabled={!selectedLineItemTemplateId}
              >
                {t('add_line_item')}
              </button>
              <button
                type="button"
                className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                onClick={() => void saveLineItemTemplate()}
                disabled={savingLineItemTemplate}
              >
                <span className="loading-inline">
                  {savingLineItemTemplate ? <span className="loading-spinner" aria-hidden="true" /> : null}
                  {savingLineItemTemplate ? t('please_wait') : t('save_template')}
                </span>
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-sm text-slate-700">
                <span>{t('description')}</span>
                <input
                  value={lineItemTemplateDraft.description}
                  onChange={(event) =>
                    setLineItemTemplateDraft((prev) => ({ ...prev, description: event.target.value }))
                  }
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
                  placeholder={editDraft.currency}
                />
              </label>
            </div>
            {lineItemTemplateMessage ? <p className="mt-2 text-sm text-slate-600">{lineItemTemplateMessage}</p> : null}
            <div className="mt-3 space-y-2">
              {itemDrafts.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>{t('description')}</span>
                    <input
                      value={item.description}
                      onChange={(event) => updateItem(index, 'description', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>{t('quantity')}</span>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>{t('unit_price')}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) => updateItem(index, 'unit_price', event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                    onClick={() => setItemDrafts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    disabled={itemDrafts.length === 1}
                  >
                    {t('remove')}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
                onClick={() => setItemDrafts((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }])}
              >
                {t('add_line_item')}
              </button>
            </div>
          </>
        ) : null}
        <div className="mt-3">
          <button type="button" onClick={() => void saveDocumentDraft()} disabled={savingDraft}>
            <span className="loading-inline">
              {savingDraft ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {savingDraft ? t('please_wait') : t('save')}
            </span>
          </button>
        </div>
      </div>

      <div className="surface p-4">
        <h2 className="mb-3 text-lg font-semibold">{t('notes')}</h2>
        <p className="text-sm font-semibold text-slate-700">{t('notes_template')}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-700">
            <span>{t('select_notes_template')}</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                const selectedId = event.target.value;
                setMessage('');
                if (selectedId === '__add_template__') {
                  setSelectedTemplateId('');
                  setTemplateName(t('new_note_template'));
                  setMessage(t('new_note_template'));
                  return;
                }
                setSelectedTemplateId(selectedId);
                const selected = noteTemplates.find((template) => template.id === selectedId);
                if (selected) setNotesDraft(selected.content);
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
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="h-[42px] self-end rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            onClick={() => void saveTemplate()}
            disabled={savingTemplate}
          >
            <span className="loading-inline">
              {savingTemplate ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {savingTemplate ? t('please_wait') : t('save_template')}
            </span>
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}

        <label className="space-y-1 text-sm text-slate-700">
          <span>{t('notes')}</span>
          <textarea
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder={t('notes')}
          />
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-none hover:bg-slate-100"
            onClick={() => void saveNotes()}
            disabled={savingNotes}
          >
            <span className="loading-inline">
              {savingNotes ? <span className="loading-spinner" aria-hidden="true" /> : null}
              {savingNotes ? t('please_wait') : t('save_notes')}
            </span>
          </button>
        </div>
      </div>

      {detail.type !== 'receipt' ? (
        <div className="surface p-4">
          <h2 className="mb-3 text-lg font-semibold">{t('items')}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100/80">
                <tr>
                  <th className="px-3 py-2 text-left">{t('description')}</th>
                  <th className="px-3 py-2 text-left">{t('quantity')}</th>
                  <th className="px-3 py-2 text-left">{t('unit_price')}</th>
                  <th className="px-3 py-2 text-left">{t('currency')}</th>
                  <th className="px-3 py-2 text-left">{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200/70">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{item.unit_price.toFixed(2)}</td>
                    <td className="px-3 py-2">{detail.currency}</td>
                    <td className="px-3 py-2">
                      {detail.currency} {item.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {detail.type === 'invoice' ? (
        <div className="surface p-4">
          <h2 className="mb-3 text-lg font-semibold">{t('payment_phases')}</h2>

          <form onSubmit={addPhase} className="mb-3 grid gap-2 md:grid-cols-4">
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('phase_title')}</span>
              <input
                placeholder={t('phase_title')}
                value={phaseForm.title}
                onChange={(e) => setPhaseForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('type')}</span>
              <select
                value={phaseForm.kind}
                onChange={(e) => setPhaseForm((prev) => ({ ...prev, kind: e.target.value }))}
              >
                <option value="percentage">{t('percentage')}</option>
                <option value="fixed">{t('fixed_amount')}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('amount')}</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={phaseForm.value}
                onChange={(e) => setPhaseForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
                required
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>{t('due')}</span>
              <input
                type="date"
                value={phaseForm.due_date}
                onChange={(e) => setPhaseForm((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </label>
            <button type="submit" disabled={addingPhase}>
              <span className="loading-inline">
                {addingPhase ? <span className="loading-spinner" aria-hidden="true" /> : null}
                {addingPhase ? t('please_wait') : t('add_phase')}
              </span>
            </button>
          </form>

          <p className="mb-2 text-sm text-slate-600">
            {t('paid_amount')}: ${paidAmount.toFixed(2)} / ${detail.total_amount.toFixed(2)}
          </p>
          {phaseMessage ? <p className="mb-2 text-sm text-slate-600">{phaseMessage}</p> : null}

          <div className="space-y-2">
            {detail.phases.map((phase) => {
              const paid = phase.payments.reduce((sum, payment) => sum + payment.amount, 0);
              const remaining = Math.max(0, phase.phase_amount - paid);

              return (
                <div key={phase.id} className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-sm">
                  <p>
                    {phase.title} ({phase.kind === 'percentage' ? t('percentage') : t('fixed_amount')}: {phase.value})
                  </p>
                  <p>
                    {t('scheduled')}: ${phase.phase_amount.toFixed(2)} | {t('paid')}: ${paid.toFixed(2)} | {t('remaining')}:{' '}
                    ${remaining.toFixed(2)}
                  </p>
                  <p>{t('due')}: {phase.due_date ?? '-'}</p>
                  <button
                    disabled={remaining <= 0 || convertingPhaseId === phase.id}
                    type="button"
                    className="mt-2"
                    onClick={() => void convertPhaseToReceipt(phase.id, remaining)}
                  >
                    <span className="loading-inline">
                      {convertingPhaseId === phase.id ? <span className="loading-spinner" aria-hidden="true" /> : null}
                      {convertingPhaseId === phase.id ? t('please_wait') : t('convert_to_receipt')}
                    </span>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(phase.receipts?.length ?? 0) > 0 ? (
                      <button
                        type="button"
                        className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                        onClick={() => void openPhaseReceipt(phase.id)}
                        disabled={openingPhaseId === phase.id}
                      >
                        <span className="loading-inline">
                          {openingPhaseId === phase.id ? <span className="loading-spinner" aria-hidden="true" /> : null}
                          {openingPhaseId === phase.id ? t('please_wait') : t('open')}
                        </span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-none hover:bg-slate-100"
                      onClick={() => void deletePhase(phase.id)}
                      disabled={deletingPhaseId === phase.id}
                    >
                      <span className="loading-inline">
                        {deletingPhaseId === phase.id ? <span className="loading-spinner" aria-hidden="true" /> : null}
                        {deletingPhaseId === phase.id ? t('please_wait') : t('delete')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
