#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { renderDocumentPdf } from '../src/lib/pdf.ts';

function usage() {
  console.log(`Usage: npm run export:pdf -- <document-id-or-number> [output.pdf]

Credentials and connection variables:
  INVOICE_EMAIL
  INVOICE_PASSWORD
  NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  INVOICE_APP_URL (optional; enables document_url and pdf_url output)

If output.pdf is omitted, the PDF is written to output/pdf/<document-number>.pdf.
`);
}

function parseEnvFile(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const parsed = parseEnvFile(await fs.readFile(file, 'utf8'));
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

function normalizeAppUrl(value) {
  const source = value?.trim();
  return source ? source.replace(/\/+$/, '') : null;
}

function safeFilename(value) {
  return String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
}

async function fetchDocument(supabase, selector, selectClause) {
  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selector);
  let query = supabase.from('documents').select(selectClause);
  query = byId ? query.eq('id', selector) : query.eq('number', selector);
  const { data, error } = await query.limit(2);
  if (error) return { document: null, error };
  if ((data ?? []).length === 0) return { document: null, error: new Error(`Document not found: ${selector}`) };
  if ((data ?? []).length > 1) {
    return { document: null, error: new Error(`Document number is ambiguous; use its UUID instead: ${selector}`) };
  }
  return { document: data[0], error: null };
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const selector = args[0];
const requestedOutput = args[1] ? path.resolve(args[1]) : null;
await loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.INVOICE_EMAIL;
const password = process.env.INVOICE_PASSWORD;
const appUrl = normalizeAppUrl(process.env.INVOICE_APP_URL);
if (!supabaseUrl || !publishableKey || !email || !password) {
  throw new Error('Supabase URL, publishable key, INVOICE_EMAIL, and INVOICE_PASSWORD are required');
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) throw new Error(`Authentication failed: ${authError.message}`);
if (!authData.user) throw new Error('Authentication failed: no user returned');

try {
  const fullSelect = '*, clients(*), organizations(name, logo_url, company_name, company_email, company_address)';
  let { document, error: documentError } = await fetchDocument(supabase, selector, fullSelect);

  if (
    documentError?.message?.includes('logo_url') ||
    documentError?.message?.includes('company_name') ||
    documentError?.message?.includes('company_email') ||
    documentError?.message?.includes('company_address')
  ) {
    const fallback = await fetchDocument(supabase, selector, '*, clients(*), organizations(name)');
    document = fallback.document;
    documentError = fallback.error;
  }

  if (documentError) throw documentError;
  if (!document?.clients) throw new Error('Client not found for this document');

  const { data: items, error: itemsError } = await supabase
    .from('document_items')
    .select('*')
    .eq('document_id', document.id)
    .order('created_at', { ascending: true });
  if (itemsError) throw itemsError;

  const buffer = await renderDocumentPdf({
    type: document.type,
    number: document.number,
    issueDate: document.issue_date,
    dueDate: document.due_date,
    currency: document.currency,
    clientName: document.clients.client_name,
    companyName: document.clients.company_name,
    clientEmail: document.clients.email,
    clientPhone: document.clients.phone,
    workspaceName: document.organizations?.name,
    workspaceLogoUrl: document.organizations?.logo_url,
    workspaceCompanyName: document.organizations?.company_name,
    workspaceEmail: document.organizations?.company_email,
    workspaceAddress: document.organizations?.company_address,
    taxPercentage: Number(document.tax_percentage),
    subtotal: Number(document.subtotal),
    taxAmount: Number(document.tax_amount),
    totalAmount: Number(document.total_amount),
    notes: document.notes,
    items: (items ?? []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
  });

  const outputPath = requestedOutput ?? path.resolve('output/pdf', `${safeFilename(document.number)}.pdf`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);

  console.log(JSON.stringify({
    success: true,
    document: {
      id: document.id,
      number: document.number,
      type: document.type,
      client_name: document.clients.client_name,
      company_name: document.clients.company_name,
      currency: document.currency,
      total_amount: Number(document.total_amount),
    },
    document_url: appUrl ? `${appUrl}/documents/${document.id}` : null,
    pdf_url: appUrl ? `${appUrl}/api/documents/${document.id}/pdf` : null,
    pdf_path: outputPath,
  }, null, 2));
} finally {
  await supabase.auth.signOut();
}
