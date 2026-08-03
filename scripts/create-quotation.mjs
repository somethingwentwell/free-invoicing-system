#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function usage() {
  console.log(`Usage: npm run create:quotation -- <quotation.json> [--dry-run]

Credentials and connection variables:
  INVOICE_EMAIL
  INVOICE_PASSWORD
  NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Quotation JSON:
  {
    "workspace": "optional exact workspace name or UUID",
    "client": { "client_name": "Laiye", "company_name": "Laiye" },
    "number": "optional custom number",
    "issue_date": "2026-08-03",
    "due_date": null,
    "currency": "USD",
    "tax_percentage": 0,
    "notes": "optional notes",
    "items": [
      { "description": "Dify Enterprise License", "quantity": 1, "unit_price": 10000 }
    ]
  }
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

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function optionalString(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`);
  return value.trim() || null;
}

function validDate(value, label, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const date = requiredString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  return date;
}

function money(value, label, { positive = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
    throw new Error(`${label} must be a ${positive ? 'positive' : 'nonnegative'} number`);
  }
  return Number(value.toFixed(2));
}

function validateSpec(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Quotation JSON must be an object');
  if (!raw.client || typeof raw.client !== 'object') throw new Error('client is required');
  if (!Array.isArray(raw.items) || raw.items.length === 0) throw new Error('items must contain at least one line item');

  const taxPercentage = raw.tax_percentage ?? 0;
  if (typeof taxPercentage !== 'number' || taxPercentage < 0 || taxPercentage > 100) {
    throw new Error('tax_percentage must be between 0 and 100');
  }

  const items = raw.items.map((item, index) => ({
    description: requiredString(item?.description, `items[${index}].description`),
    quantity: money(item?.quantity, `items[${index}].quantity`, { positive: true }),
    unit_price: money(item?.unit_price, `items[${index}].unit_price`),
  }));
  const subtotal = Number(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toFixed(2));
  const taxAmount = Number((subtotal * (taxPercentage / 100)).toFixed(2));

  return {
    workspace: optionalString(raw.workspace, 'workspace'),
    client: {
      client_name: requiredString(raw.client.client_name, 'client.client_name'),
      company_name: requiredString(raw.client.company_name, 'client.company_name'),
      phone: optionalString(raw.client.phone, 'client.phone'),
      email: optionalString(raw.client.email, 'client.email'),
    },
    number: optionalString(raw.number, 'number'),
    issue_date: validDate(raw.issue_date, 'issue_date'),
    due_date: validDate(raw.due_date, 'due_date', true),
    currency: requiredString(raw.currency ?? 'USD', 'currency').toUpperCase(),
    tax_percentage: Number(taxPercentage.toFixed(2)),
    notes: optionalString(raw.notes, 'notes'),
    items,
    subtotal,
    tax_amount: taxAmount,
    total_amount: Number((subtotal + taxAmount).toFixed(2)),
  };
}

async function resolveWorkspace(supabase, userId, selector) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const workspaces = (data ?? []).flatMap((membership) => {
    const org = membership.organizations;
    if (!org) return [];
    return Array.isArray(org) ? org : [org];
  });
  if (workspaces.length === 0) throw new Error('The authenticated user has no workspace');
  if (!selector && workspaces.length === 1) return workspaces[0];
  if (!selector) {
    throw new Error(`Multiple workspaces found; set "workspace" to one of: ${workspaces.map((org) => org.name).join(', ')}`);
  }

  const normalized = selector.toLowerCase();
  const matches = workspaces.filter((org) => org.id === selector || String(org.name).toLowerCase() === normalized);
  if (matches.length !== 1) throw new Error(`Workspace not found or ambiguous: ${selector}`);
  return matches[0];
}

async function resolveClient(supabase, userId, organizationId, clientInput) {
  const { data: matches, error: findError } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('client_name', clientInput.client_name)
    .ilike('company_name', clientInput.company_name)
    .limit(2);
  if (findError) throw findError;
  if ((matches ?? []).length === 1) return { client: matches[0], created: false };
  if ((matches ?? []).length > 1) throw new Error('Multiple matching clients found; resolve the duplicate clients before continuing');

  const { data: client, error: createError } = await supabase
    .from('clients')
    .insert({ organization_id: organizationId, ...clientInput, created_by: userId })
    .select('*')
    .single();
  if (createError) throw createError;
  return { client, created: true };
}

async function insertQuotation(supabase, userId, organizationId, clientId, spec) {
  const { count, error: countError } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('type', 'quotation');
  if (countError) throw countError;

  const startSequence = Math.max(1, (count ?? 0) + 1);
  let document = null;
  let lastError = null;

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const number = spec.number ?? `Q-${String(startSequence + attempt).padStart(4, '0')}`;
    const { data, error } = await supabase
      .from('documents')
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        type: 'quotation',
        status: 'draft',
        number,
        issue_date: spec.issue_date,
        due_date: spec.due_date,
        currency: spec.currency,
        tax_percentage: spec.tax_percentage,
        subtotal: spec.subtotal,
        tax_amount: spec.tax_amount,
        total_amount: spec.total_amount,
        notes: spec.notes,
        created_by: userId,
      })
      .select('*')
      .single();

    if (!error) {
      document = data;
      break;
    }
    lastError = error;
    if (spec.number || error.code !== '23505') throw error;
  }
  if (!document) throw lastError ?? new Error('Failed to allocate a unique quotation number');

  const { error: itemError } = await supabase.from('document_items').insert(
    spec.items.map((item) => ({
      document_id: document.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: Number((item.quantity * item.unit_price).toFixed(2)),
    })),
  );
  if (itemError) {
    await supabase.from('documents').delete().eq('id', document.id);
    throw itemError;
  }
  return document;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

const dryRun = args.includes('--dry-run');
const inputArg = args.find((arg) => !arg.startsWith('-'));
if (!inputArg) throw new Error('Quotation JSON path is required');
const inputPath = path.resolve(inputArg);
const spec = validateSpec(JSON.parse(await fs.readFile(inputPath, 'utf8')));

if (dryRun) {
  console.log(JSON.stringify({ valid: true, quotation: spec }, null, 2));
  process.exit(0);
}

await loadLocalEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.INVOICE_EMAIL;
const password = process.env.INVOICE_PASSWORD;
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
  const workspace = await resolveWorkspace(supabase, authData.user.id, spec.workspace);
  const { client, created: clientCreated } = await resolveClient(
    supabase,
    authData.user.id,
    workspace.id,
    spec.client,
  );
  const quotation = await insertQuotation(supabase, authData.user.id, workspace.id, client.id, spec);
  console.log(JSON.stringify({
    success: true,
    workspace: { id: workspace.id, name: workspace.name },
    client: { id: client.id, name: client.client_name, created: clientCreated },
    quotation: {
      id: quotation.id,
      number: quotation.number,
      status: quotation.status,
      currency: quotation.currency,
      subtotal: Number(quotation.subtotal),
      tax_amount: Number(quotation.tax_amount),
      total_amount: Number(quotation.total_amount),
    },
  }, null, 2));
} finally {
  await supabase.auth.signOut();
}
