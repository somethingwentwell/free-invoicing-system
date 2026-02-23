export type DocumentType = 'quotation' | 'invoice' | 'receipt';
export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'partially_paid'
  | 'paid'
  | 'overdue';

export interface ClientInput {
  client_name: string;
  company_name: string;
  phone?: string | null;
  email?: string | null;
}

export interface DocumentItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface PaymentPhaseInput {
  title: string;
  kind: 'percentage' | 'fixed';
  value: number;
  due_date?: string | null;
}
