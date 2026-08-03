---
name: free-invoicing-system
description: Build, modify, operate, debug, test, or explain the Free Invoicing System in this repository. Use for browserless authenticated CLI/API operations or source work involving its Next.js and Supabase architecture, authentication, workspaces and members, company details, clients, quotations, invoices, receipts, payment phases, payments, document conversion and numbering, templates, dashboard totals, PDF links and in-agent PDF previews, multilingual UI, migrations, RLS, deployment, or administration scripts.
---

# Free Invoicing System

## Start with repository truth

1. Work from the repository root containing `package.json` and `supabase/`.
2. Read `references/system-map.md` for the relevant feature area.
3. Inspect the current implementation before changing it. Treat the reference as a map, not a substitute for source code.
4. Check `git status --short` and preserve unrelated user changes.

## Prefer browserless operation

1. Use repository CLI scripts or authenticated APIs for operational requests. Do not require an app browser.
2. For quotation creation, write the requested fields to a temporary JSON file and run `npm run create:quotation -- <file>`. Read `references/system-map.md` for the schema and credentials.
3. Authenticate with the user's Supabase email/password and publishable configuration. Preserve RLS; never substitute a service-role key for ordinary invoicing work.
4. Use `--dry-run` before a live write when calculations, workspace selection, or optional items are ambiguous.
5. Inspect and edit the source when a requested browserless operation is missing. Add the smallest authenticated CLI/API surface that reuses existing rules, then validate it.
6. Use browser automation only when the user explicitly asks for UI interaction or when visual verification is essential and no browserless surface can provide it.

## Return PDF links and previews

After creating or locating a document:

1. Run `npm run export:pdf -- <document-id-or-number> <absolute-output.pdf>` with the normal authenticated environment and `INVOICE_APP_URL` set.
2. Read the command's JSON result and return both `document_url` and `pdf_url`. State that the URLs require an authenticated app login.
3. Render every page of `pdf_path` to PNG with the PDF skill and inspect the images for clipping, overlap, missing glyphs, incorrect totals, or broken layout.
4. Fix the source renderer and re-export when visual QA fails. Do not deliver an unverified PDF.
5. Show the local PDF as a clickable file citation and embed the rendered first page as an inline image preview using its absolute path. Do not cite the PNG.
6. Keep PDF exports under `output/pdf/` and temporary page renders under `tmp/pdfs/`.

## Follow the architecture

- Require a valid Supabase login for every dashboard, workspace, and invoicing operation. Login may occur through the CLI/API and does not require a browser.
- Keep browser UI in `src/components/` and App Router pages in `src/app/`.
- Keep authenticated server operations in `src/app/api/`; use `requireUser()` and rely on Supabase RLS as defense in depth.
- Validate request data with Zod schemas in `src/lib/validations.ts`.
- Keep shared money calculations in `src/lib/math.ts` and numbering rules in `src/lib/numbering.ts`.
- Keep domain types in `src/types/domain.ts`.
- Add schema or policy changes as a new ordered migration. Do not rewrite an applied migration unless the user explicitly requests it.
- Update all three locales when adding or changing user-visible copy: English, Traditional Chinese, and Simplified Chinese.

## Preserve business invariants

- Never bypass login to make a feature work. API handlers must call `requireUser()` before reading request-scoped business data.
- Scope business records to `organization_id`; never trust a client-supplied workspace without membership enforcement.
- Allow document types only in the progression quotation → invoice → receipt. Never convert a receipt further.
- Require line items for normal document creation. Keep receipts itemless, with zero tax and an explicitly stored amount.
- Round line totals, subtotal, tax, and total to two decimal places using the existing helpers and conventions.
- Keep document numbers unique within a workspace. Preserve related numbering for conversions and phase receipts.
- Link conversions through `parent_document_id`, `payment_group_invoice_id`, `payment_phase_id`, and `document_conversions` as applicable.
- Prevent direct invoice receipts from exceeding the remaining unreceipted amount.
- Recompute invoice and phase payment status from monetary records rather than status labels alone.
- Restrict workspace and membership administration to owners; keep ordinary business data available only to workspace members.

## Implement changes end to end

For a feature or bug fix, trace and update every affected layer:

1. Database schema, constraints, functions, and RLS.
2. Domain types and Zod validation.
3. API read/write behavior and error handling.
4. Components, pages, loading/error state, and responsive behavior.
5. Translation keys in every locale.
6. PDF rendering when document-visible data changes.
7. Dashboard aggregation when monetary semantics change.
8. README when setup, environment variables, migrations, or user-facing scope changes.

For authentication changes, verify login, registration with email confirmation, logout, session refresh, protected dashboard navigation, forgotten-password email, reset-password redirect, and the final return to login.

Prefer the smallest coherent change. Do not introduce a parallel data-access pattern or calculation path when an existing helper can be extended.

## Verify proportionately

Run the strongest checks supported by the change:

```bash
npm run typecheck
npm run build
```

Also inspect the exact flows affected. For schema work, review policy interactions and migration ordering. For document work, verify create, edit, conversion, numbering, totals, related navigation, and PDF output. For payment work, verify partial, exact, multiple, and overpayment boundaries.

Report commands run, results, and any verification that could not be completed because credentials or external services were unavailable.
