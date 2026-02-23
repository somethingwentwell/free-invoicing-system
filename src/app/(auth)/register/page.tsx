import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { LanguageSwitcher } from '@/components/language-switcher';
import { t } from '@/lib/i18n';
import { getServerLanguage } from '@/lib/i18n-server';

export default async function RegisterPage() {
  const lang = await getServerLanguage();

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <AuthForm mode="register" />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t(lang, 'auth_already_account')}{' '}
          <Link className="font-semibold text-slate-900 underline-offset-2 hover:underline" href="/login">
            {t(lang, 'auth_login')}
          </Link>
        </p>
      </div>
    </main>
  );
}
