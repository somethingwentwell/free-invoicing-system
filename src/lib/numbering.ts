import type { DocumentType } from '@/types/domain';

const prefixMap: Record<DocumentType, string> = {
  quotation: 'Q',
  invoice: 'INV',
  receipt: 'RCPT'
};

export function createNextDocumentNumber(type: DocumentType, sequence: number) {
  return `${prefixMap[type]}-${String(sequence).padStart(4, '0')}`;
}

function normalizeReference(sourceNumber: string) {
  const normalized = sourceNumber.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '');
  return normalized || null;
}

function withOccurrenceSuffix(base: string, index: number) {
  if (index <= 1) return base;
  return `${base}-${String(index).padStart(2, '0')}`;
}

export function createInvoiceNumberFromQuotation(quotationNumber: string, index: number = 1) {
  const ref = normalizeReference(quotationNumber);
  if (!ref) return null;
  return withOccurrenceSuffix(`INV-${ref}`, index);
}

export function createReceiptNumberFromInvoice(
  invoiceNumber: string,
  options?: {
    phaseCode?: string | null;
    index?: number;
  }
) {
  const ref = normalizeReference(invoiceNumber);
  if (!ref) return null;

  const normalizedPhase = options?.phaseCode?.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '') ?? '';
  const phasePart = normalizedPhase ? `-${normalizedPhase}` : '';
  return withOccurrenceSuffix(`RCPT-${ref}${phasePart}`, Math.max(1, options?.index ?? 1));
}
