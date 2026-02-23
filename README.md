# Free Invoicing System

An invoicing web app built for **individuals and small/medium businesses**.

The scope is intentionally focused on what SMBs actually need:
- create and manage clients
- create quotation / invoice / receipt documents
- handle partial payments and payment phases
- generate client-ready PDF

It is designed to be **free to deploy and free to use** (for example on Supabase + Vercel free tiers).

## Product scope
- Practical SMB-first workflow (no enterprise bloat)
- Workspace-based collaboration (`owner`, `member`)
- Multi-language UI: English / Traditional Chinese / Simplified Chinese
- Responsive layout (desktop + mobile)
- Black/white/light-gray visual theme with solid controls

## Features
### Authentication and workspaces
- Email/password authentication with Supabase Auth
- Personal workspace auto-created after signup
- Multiple workspaces per user
- Save default workspace
- Workspace member management (add existing registered users)

### Company and client management
- Company details per workspace:
  - logo URL (optional)
  - company name
  - company email (optional)
  - company address (optional)
  - default currency
- Client CRUD:
  - client name
  - company name
  - phone (optional)
  - email (optional)

### Documents
- Document types:
  - quotation
  - invoice
  - receipt
- Document list with:
  - search
  - type filter
  - pagination
  - open / delete actions
- Create document and jump directly to the created detail page
- Edit document number, dates, currency, notes, totals (receipt)
- Conversion flows:
  - quotation -> invoice
  - invoice -> receipt
  - invoice payment phase -> receipt
- Back-link navigation:
  - invoice -> back to quotation (if exists)
  - receipt -> back to invoice (if exists)

### Payments and receipts
- Invoice payment phases:
  - percentage or fixed amount
  - convert remaining amount to receipt
- Receipt behavior:
  - no line items
  - notes auto-generated as payment summary:
    - `Receipt for invoice {invoice number} - {percent}% ({amount} / {invoice total})`
    - empty if no invoice number
- Receipt paid status can be edited

### Templates
- Note template CRUD
- Line item template CRUD
- Templates can be created/used directly inside document screens
- Line item template supports editable currency
- Line item template default currency follows workspace default currency

### PDF
- In-browser preview PDF
- Direct download PDF export
- PDF includes:
  - company details and optional logo
  - client details
  - items table (for non-receipts)
  - notes

### Dashboard
- KPI cards:
  - invoices
  - total invoiced
  - paid invoices
  - paid amount
  - outstanding
- Outstanding and paid amount are computed from invoice/receipt amounts, not only status text

## Tech stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + RLS)
- Tailwind CSS

## Environment
Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_AUTH_REDIRECT_URL` (for email confirmation redirect, e.g. `https://your-domain.com/login`)
- `NEXT_PUBLIC_AUTH_RESET_REDIRECT_URL` (for password reset redirect, e.g. `https://your-domain.com/reset-password`)

## Database migrations
Run SQL files in `supabase/migrations`.

Recommended for a new database:
1. Run `001_init.sql`
2. Run the rest in order (`002...` to latest)

For environments that need a one-shot catch-up script for recent schema/policy updates:
- `100_consolidated_updates.sql`

## Local development
```bash
npm install
npm run dev
```

## Backend admin script: add user
You can create a Supabase Auth user from backend/admin side with Bash:

```bash
npm run add:user -- user@example.com 'StrongPassword123!' true
```

Arguments:
- `email` (required)
- `password` (required)
- `auto_confirm` (optional, `true` or `false`, default `true`)

Required env for this script:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)

## Deployment guide (Supabase -> Vercel)
Follow this order:
1. Create Supabase project
2. Apply database migrations
3. Deploy app to Vercel
4. Attach custom domain
5. Verify HTTPS/SSL

### 1) Create Supabase project
1. Go to Supabase and create a new project.
2. Open `Project Settings -> API`.
3. Copy:
   - Project URL
   - Publishable (anon) key
4. Keep these values for Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### 2) Apply migrations in Supabase
1. Open Supabase SQL Editor.
2. Run migrations from `supabase/migrations`.
3. For a fresh project, run:
   - `001_init.sql`
   - then all remaining migration files in order
4. If your environment needs quick catch-up for later updates, also run:
   - `100_consolidated_updates.sql`

### 3) Deploy to Vercel
1. Push this repository to GitHub.
2. In Vercel, click `Add New Project` and import the GitHub repo.
3. In project environment variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_AUTH_REDIRECT_URL`
   - `NEXT_PUBLIC_AUTH_RESET_REDIRECT_URL`
4. Deploy.
5. After first deploy, open the app URL and test:
   - register/login
   - create workspace/client/document
   - PDF preview/export

### 4) Set custom domain name on Vercel
1. In Vercel project, go to `Settings -> Domains`.
2. Add your domain (example: `app.yourdomain.com`).
3. Vercel will show required DNS records (usually `CNAME` for subdomain, or `A`/`ALIAS` for apex/root domain).
4. Go to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) and add those records.
5. Wait for DNS propagation, then verify domain status in Vercel is active.

### 5) SSL certificate (HTTPS)
- On Vercel, SSL certificates are automatically provisioned and renewed for connected domains.
- No manual certificate purchase/install is required in normal cases.
- After domain is active, confirm `https://your-domain` loads successfully.
- If SSL is pending, check DNS records first (most SSL issues are DNS mismatch).

## Deployment notes
- This app only needs the Supabase publishable key on frontend; service role key is not required for normal runtime.
- If you add new database features later, remember to run new SQL migrations in Supabase before or right after redeploying Vercel.

## Security model
- RLS-enabled tables in Supabase
- Workspace membership checks enforced at DB/API level
- Owner-only operations for workspace/member settings
