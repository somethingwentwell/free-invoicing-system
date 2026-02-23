import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { createClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n';
import { getServerLanguage } from '@/lib/i18n-server';
import { SignOutButton } from '@/components/sign-out-button';
import { OrgSelector } from '@/components/org-selector';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLanguage();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', user.id);

  const organizations = (memberships ?? [])
    .map((membership) => membership.organizations)
    .filter((org): org is { id: string; name: string } => Boolean(org));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden h-screen border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold tracking-wide text-slate-800"
          >
            <img src="/logo.svg" alt="Invoicing logo" className="h-6 w-6 rounded-md" />
            <span>{t(lang, 'app_name')}</span>
          </Link>
          <OrgSelector organizations={organizations} />

          <nav className="flex flex-col gap-1 text-sm">
            <Link className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100" href="/dashboard">
              {t(lang, 'dashboard')}
            </Link>
            <Link className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100" href="/documents">
              {t(lang, 'documents')}
            </Link>
            <Link className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100" href="/clients">
              {t(lang, 'clients')}
            </Link>
            <Link className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100" href="/note-templates">
              {t(lang, 'note_templates')}
            </Link>
            <Link
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
              href="/line-item-templates"
            >
              {t(lang, 'line_item_templates')}
            </Link>
            <Link className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100" href="/company-details">
              {t(lang, 'company_details')}
            </Link>
          </nav>

          <div className="mt-auto space-y-2">
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <p
                className="min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                title={user.email ?? t(lang, 'unknown_user')}
              >
                {user.email ?? t(lang, 'unknown_user')}
              </p>
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold tracking-wide text-slate-800"
            >
              <img src="/logo.svg" alt="Invoicing logo" className="h-6 w-6 rounded-md" />
              <span>{t(lang, 'app_name')}</span>
            </Link>

            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                Menu
              </summary>
              <div className="absolute right-0 top-12 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="mb-3">
                  <OrgSelector organizations={organizations} />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard">
                    {t(lang, 'dashboard')}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/documents">
                    {t(lang, 'documents')}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/clients">
                    {t(lang, 'clients')}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/note-templates">
                    {t(lang, 'note_templates')}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/line-item-templates">
                    {t(lang, 'line_item_templates')}
                  </Link>
                  <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/company-details">
                    {t(lang, 'company_details')}
                  </Link>
                  <div className="pt-1">
                    <LanguageSwitcher />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                      title={user.email ?? t(lang, 'unknown_user')}
                    >
                      {user.email ?? t(lang, 'unknown_user')}
                    </p>
                    <SignOutButton />
                  </div>
                </div>
              </div>
            </details>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
