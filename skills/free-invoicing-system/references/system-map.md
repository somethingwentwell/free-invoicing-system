# System map

## Architecture

- Runtime: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS.
- Backend: Supabase Auth and Postgres accessed through `@supabase/ssr`.
- Security: authenticated API handlers plus row-level security based on workspace membership.
- PDF: `pdf-lib` with bundled Noto Sans SC fonts for multilingual output.
- Main UI: route pages in `src/app/(dashboard)/`; stateful managers in `src/components/`.

## Core locations

| Area | Primary source |
| --- | --- |
| Authentication | `src/lib/auth.ts`, `src/lib/supabase/`, `src/app/(auth)/` |
| Workspace selection | `src/components/org-selector.tsx`, `src/app/api/organizations/`, `src/app/api/profiles/default-workspace/route.ts` |
| Workspace members | `src/components/workspace-management-manager.tsx`, `src/app/api/organizations/[id]/members/` |
| Company profile | `src/components/company-details-manager.tsx`, organization API and profile migrations |
| Clients | `src/components/clients-manager.tsx`, `src/app/api/clients/` |
| Documents | `src/components/documents-manager.tsx`, `src/components/document-detail.tsx`, `src/app/api/documents/` |
| Note templates | `src/components/note-templates-manager.tsx`, `src/app/api/document-note-templates/` |
| Line-item templates | `src/components/line-item-templates-manager.tsx`, `src/app/api/line-item-templates/` |
| Dashboard | `src/components/dashboard-overview.tsx` |
| PDF | `src/lib/pdf.ts`, `src/app/api/documents/[id]/pdf/route.ts` |
| Types and validation | `src/types/domain.ts`, `src/lib/validations.ts` |
| Totals and numbering | `src/lib/math.ts`, `src/lib/numbering.ts` |
| Localization | `src/lib/i18n.ts`, `src/lib/i18n-server.ts`, `src/components/i18n-provider.tsx` |
| Database | `supabase/migrations/` |

## Data model

- `profiles`: user profile and default workspace metadata.
- `organizations`: workspaces plus company details and default currency added by later migrations.
- `organization_members`: unique user/workspace membership with `owner` or `member` role.
- `clients`: workspace-scoped customer records.
- `documents`: quotations, invoices, and receipts. Document number is unique per workspace.
- `document_items`: quantity, unit price, and stored line total; cascade with document deletion.
- `document_conversions`: audit link from source to target document.
- `invoice_payment_phases`: percentage or fixed invoice milestones and their calculated phase amount.
- `payments`: payments recorded against phases.
- `document_note_templates`: reusable workspace-scoped notes.
- `line_item_templates`: reusable description, quantity, unit price, and currency.

Read the latest migrations rather than assuming `001_init.sql` is the final schema. The numbered migrations include policy repairs and consolidated catch-up scripts.

## Document rules

### Creation and editing

- Types: `quotation`, `invoice`, `receipt`.
- Statuses: `draft`, `sent`, `accepted`, `rejected`, `partially_paid`, `paid`, `overdue`.
- Standard totals: subtotal = sum(quantity × unit price); tax = subtotal × tax percentage; total = subtotal + tax. Round each stored result to two decimals.
- Auto-number prefixes: `Q-`, `INV-`, and `RCPT-`, with a four-digit sequence.
- API creation currently validates at least one item. Receipts produced through conversion/payment routes are intentionally itemless.
- Receipt edits clear items, force zero tax, and accept a nonnegative explicit `total_amount`.

### Conversion

- Quotation → invoice copies items, client, currency, tax, notes, and due date; the new invoice starts as draft.
- Invoice → receipt accepts an optional amount, defaults to the remaining amount, rejects amounts above the remainder, creates an itemless paid receipt, and updates the invoice to partially paid or paid.
- Receipt → anything is invalid.
- Related numbering derives from the source number and adds a two-digit occurrence suffix for duplicates.
- Conversion relationships must be recorded in both document link columns and `document_conversions`.

### Payment phases

- Phases exist only on invoices.
- Percentage phase amount = invoice total × percentage / 100; fixed phase amount = entered value.
- Recording a payment creates both a `payments` record and a paid receipt tied to the invoice and phase.
- Phase receipts use a stable `PH01`, `PH02`, … code based on phase creation order.
- A phase is paid when payments reach its phase amount. Invoice status becomes paid only when every phase is paid; otherwise it becomes partially paid.
- Payment receipt notes summarize invoice number, payment percentage, payment amount, and invoice total.

## Workspace and security rules

- Login is mandatory before accessing dashboard or invoice-system data. Do not add anonymous invoicing flows.
- Email/password login uses `supabase.auth.signInWithPassword`; successful login navigates to `/dashboard`.
- Registration uses `supabase.auth.signUp` and `NEXT_PUBLIC_AUTH_REDIRECT_URL`, falling back to `/login`. When email confirmation is enabled, show the confirmation state instead of assuming a session exists.
- Forgotten-password email uses `supabase.auth.resetPasswordForEmail` and `NEXT_PUBLIC_AUTH_RESET_REDIRECT_URL`, falling back to `/reset-password`.
- Password reset requires the recovery session, calls `supabase.auth.updateUser`, then returns the user to `/login`.
- Middleware refreshes the Supabase session cookies. Server API routes still call `requireUser()` and return 401 when no verified user is available.
- Sign-out must clear the Supabase session and return the user to an authentication entry point.
- Signup creates a profile, personal workspace, and owner membership through a database trigger.
- Users may belong to multiple workspaces and store a default workspace.
- Members can work with workspace business data; workspace/member administration is owner-only.
- Every new table or query containing business data must preserve workspace isolation.
- RLS helper and membership policies have historical recursion fixes. Review the latest policy migrations before changing them.
- Never expose or place `SUPABASE_SERVICE_ROLE_KEY` in browser code. It is only for the backend `scripts/add-user.sh` workflow.

## Product behavior

- Company details include name, optional email/address/logo URL, and default currency.
- Client records require client and company names; phone is optional; email is optional but validated when present.
- Document list supports search by document number/client/company, type filter, and pagination.
- Note and line-item templates are workspace-scoped and usable from document screens.
- Dashboard totals must derive paid and outstanding money from invoice/receipt amounts, not only status strings.
- PDFs contain company details/logo, client details, items for non-receipts, and notes.
- UI supports English, Traditional Chinese, and Simplified Chinese and must remain responsive.

## API conventions

- Return 401 from `requireUser()` when unauthenticated.
- Return 400 for validation or Supabase write/query errors, 404 for missing single resources, and 201 for successful creation.
- Parse request bodies with the shared Zod schemas where available.
- Let RLS enforce record visibility, but keep explicit type and workflow checks in route handlers.
- Keep nested dynamic route parameters typed as `Promise<{ id: string }>` to match the current Next.js conventions.

## Operational workflows

- Browserless quotation creation: run `npm run create:quotation -- <quotation.json>`. Add `--dry-run` to validate and calculate without a live write.
- CLI authentication variables: `INVOICE_EMAIL` and `INVOICE_PASSWORD`. Connection variables: `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The script loads `.env.local` and `.env` when present.
- Quotation JSON accepts `workspace` (exact name or UUID, optional for a user with one workspace), `client`, optional `number`, `issue_date`, optional `due_date`, `currency`, `tax_percentage`, optional `notes`, and one or more `items` with description, positive quantity, and nonnegative unit price.
- The quotation CLI logs in with `signInWithPassword`, relies on the user's RLS permissions, finds or creates the client, computes two-decimal totals, allocates a unique `Q-####` number, and cleans up the document if item creation fails.
- Browserless PDF export: run `npm run export:pdf -- <document-id-or-number> [output.pdf]`. It authenticates with the same user, reads only RLS-visible document data, calls the existing `src/lib/pdf.ts` renderer, and returns `document_url`, `pdf_url`, and `pdf_path`.
- Set `INVOICE_APP_URL` to the deployed app origin to populate the returned links. App and PDF URLs remain login-protected; the local PDF is the agent-preview artifact.
- After export, render every PDF page with Poppler, visually inspect it, show the first rendered page inline, and cite the PDF file once in the final response.
- Do not use a service-role key for normal CLI document operations. Do not place credentials in committed JSON files or command arguments; pass them as environment variables.
- Local setup: copy `.env.example` to `.env.local`, configure Supabase public variables, run `npm install`, then `npm run dev`.
- Required public variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_AUTH_REDIRECT_URL`, and `NEXT_PUBLIC_AUTH_RESET_REDIRECT_URL`.
- Fresh database: apply `001_init.sql`, then remaining ordered migrations. Consolidated scripts exist for catch-up and organization-member RLS repair; inspect the target database history before applying them.
- Deployment target described by the project: Supabase plus Vercel.
- Admin user creation: `npm run add:user -- user@example.com 'StrongPassword123!' true`, requiring server-only Supabase URL and service-role key.

## Change checklists

### Change authentication

1. Preserve email/password login and the required authenticated boundary for all invoicing features.
2. Review browser and server Supabase clients, cookie refresh middleware, and `requireUser()` together.
3. Keep confirmation and password-reset redirect URLs configurable for local and deployed origins.
4. Update all authentication states and messages in every locale.
5. Verify unauthenticated API calls return 401 and protected pages do not leak workspace data.

### Add a document field

1. Add a migration and any constraints/indexes.
2. Update types and Zod schemas.
3. Update create, read, patch, conversion, and PDF routes as applicable.
4. Update forms/details/list and all locales.
5. Decide whether templates, dashboard metrics, or conversion copying should include it.

### Change money or payment behavior

1. Define rounding, currency, partial-payment, and overpayment semantics.
2. Update shared calculations before callers.
3. Review direct conversion and phase-payment flows together.
4. Review invoice status derivation and dashboard aggregation.
5. Test zero, fractional, partial, exact, repeated, and excessive amounts.

### Change workspace access

1. Identify allowed roles and operations.
2. Add or update database functions and RLS in a new migration.
3. Match API checks and UI visibility to the policies.
4. Test owner, member, non-member, and cross-workspace access.
