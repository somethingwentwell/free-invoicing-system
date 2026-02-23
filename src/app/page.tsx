import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { t } from '@/lib/i18n';
import { getServerLanguage } from '@/lib/i18n-server';

export default async function HomePage() {
  const lang = await getServerLanguage();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-12">
      <section className="surface w-full overflow-hidden p-8 md:p-12">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {t(lang, 'home_badge')}
          </p>
          <LanguageSwitcher />
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
          {t(lang, 'home_title')}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
          {t(lang, 'home_subtitle')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            href="/login"
          >
            {t(lang, 'login')}
          </Link>
          <Link
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            href="/register"
          >
            {t(lang, 'register')}
          </Link>
        </div>
        <div className="mt-10 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3">{t(lang, 'home_feature_1')}</p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3">{t(lang, 'home_feature_2')}</p>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3">{t(lang, 'home_feature_3')}</p>
        </div>
      </section>
    </main>
  );
}
