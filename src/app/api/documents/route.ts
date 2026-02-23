import { NextResponse } from 'next/server';
import { calculateTotals } from '@/lib/math';
import { createNextDocumentNumber } from '@/lib/numbering';
import { requireUser } from '@/lib/auth';
import { documentSchema } from '@/lib/validations';

async function generateUniqueNumber(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  organizationId: string,
  type: Parameters<typeof createNextDocumentNumber>[0],
  startSequence: number
) {
  let sequence = Math.max(1, startSequence);

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const candidate = createNextDocumentNumber(type, sequence);
    const { data: existing, error } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('number', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!existing) return candidate;
    sequence += 1;
  }

  throw new Error('Failed to generate unique document number');
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  const type = searchParams.get('type');
  const queryText = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('page_size') ?? 10) || 10));

  if (!organizationId) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });

  let query = auth.supabase
    .from('documents')
    .select('*, clients(*)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const filtered = (data ?? []).filter((doc) => {
    if (!queryText) return true;

    const number = String(doc.number ?? '').toLowerCase();
    const clientName = String(doc.clients?.client_name ?? '').toLowerCase();
    const companyName = String(doc.clients?.company_name ?? '').toLowerCase();

    return number.includes(queryText) || clientName.includes(queryText) || companyName.includes(queryText);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagedData = filtered.slice(start, start + pageSize);

  return NextResponse.json({
    data: pagedData,
    total,
    page: safePage,
    page_size: pageSize,
    total_pages: totalPages
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const body = await request.json();
  const parsed = documentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const payload = parsed.data;
  const totals = calculateTotals(payload.items, payload.tax_percentage);

  const { count, error: countError } = await auth.supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', payload.organization_id)
    .eq('type', payload.type);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 400 });

  const autoNumber = await generateUniqueNumber(auth.supabase, payload.organization_id, payload.type, (count ?? 0) + 1);
  const documentNumber = payload.number?.trim() ? payload.number.trim() : autoNumber;

  const { data: document, error: documentError } = await auth.supabase
    .from('documents')
    .insert({
      organization_id: payload.organization_id,
      client_id: payload.client_id,
      type: payload.type,
      status: payload.status,
      number: documentNumber,
      issue_date: payload.issue_date,
      due_date: payload.due_date ?? null,
      currency: payload.currency,
      tax_percentage: payload.tax_percentage,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total_amount: totals.total_amount,
      notes: payload.notes ?? null,
      created_by: auth.user.id
    })
    .select('*')
    .single();

  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 400 });

  const itemsPayload = payload.items.map((item) => ({
    document_id: document.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: Number((item.quantity * item.unit_price).toFixed(2))
  }));

  const { error: itemsError } = await auth.supabase.from('document_items').insert(itemsPayload);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  return NextResponse.json(document, { status: 201 });
}
