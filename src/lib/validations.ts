import { z } from 'zod';

export const clientSchema = z.object({
  client_name: z.string().min(1),
  company_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable()
});

export const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative()
});

export const documentSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  number: z.string().min(1).max(64).optional().nullable(),
  type: z.enum(['quotation', 'invoice', 'receipt']),
  status: z
    .enum(['draft', 'sent', 'accepted', 'rejected', 'partially_paid', 'paid', 'overdue'])
    .default('draft'),
  issue_date: z.string().date(),
  due_date: z.string().date().nullable().optional(),
  currency: z.string().default('USD'),
  tax_percentage: z.number().min(0).max(100),
  notes: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1)
});

export const phaseSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  due_date: z.string().date().nullable().optional()
});

export const paymentSchema = z.object({
  amount: z.number().positive(),
  paid_on: z.string().date(),
  note: z.string().nullable().optional()
});

export const documentNoteTemplateSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  content: z.string().min(1)
});

export const lineItemTemplateSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  currency: z.string().min(1).max(12).default('USD')
});
