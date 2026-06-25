import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { renderDocumentPdf } from '@/lib/pdf';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.user) return auth.unauthorized;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const shouldDownload = searchParams.get('download') === '1';

  let { data: doc, error: docError } = await auth.supabase
    .from('documents')
    .select('*, clients(*), organizations(name, logo_url, company_name, company_email, company_address)')
    .eq('id', id)
    .single();

  if (
    docError?.message.includes('logo_url') ||
    docError?.message.includes('company_name') ||
    docError?.message.includes('company_email') ||
    docError?.message.includes('company_address')
  ) {
    const fallback = await auth.supabase
      .from('documents')
      .select('*, clients(*), organizations(name)')
      .eq('id', id)
      .single();

    doc = fallback.data as typeof doc;
    docError = fallback.error;
  }

  if (docError) return NextResponse.json({ error: docError.message }, { status: 404 });
  if (!doc.clients) return NextResponse.json({ error: 'Client not found for this document' }, { status: 404 });

  const { data: items, error: itemsError } = await auth.supabase
    .from('document_items')
    .select('*')
    .eq('document_id', id);

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 });

  const buffer = await renderDocumentPdf({
    type: doc.type,
    number: doc.number,
    issueDate: doc.issue_date,
    dueDate: doc.due_date,
    currency: doc.currency,
    clientName: doc.clients.client_name,
    companyName: doc.clients.company_name,
    clientEmail: doc.clients.email,
    clientPhone: doc.clients.phone,
    workspaceName: doc.organizations?.name,
    workspaceLogoUrl: doc.organizations?.logo_url,
    workspaceCompanyName: doc.organizations?.company_name,
    workspaceEmail: doc.organizations?.company_email,
    workspaceAddress: doc.organizations?.company_address,
    taxPercentage: doc.tax_percentage,
    subtotal: doc.subtotal,
    taxAmount: doc.tax_amount,
    totalAmount: doc.total_amount,
    notes: doc.notes,
    items: (items ?? []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total
    }))
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename=\"${doc.number}.pdf\"`
    }
  });
}
