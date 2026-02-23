'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  const { t } = useI18n();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-none hover:bg-slate-100"
      onClick={handleSignOut}
    >
      {t('sign_out')}
    </button>
  );
}
