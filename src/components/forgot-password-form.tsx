'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import { createClient } from '@/lib/supabase/client';

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage('');

    const redirectTo =
      process.env.NEXT_PUBLIC_AUTH_RESET_REDIRECT_URL?.trim() ||
      (typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || undefined
    });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t('reset_link_sent'));
  }

  return (
    <form onSubmit={onSubmit} className="surface mx-auto flex w-full max-w-md flex-col gap-4 p-7 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('forgot_password_title')}</h1>
        <p className="text-sm text-slate-500">{t('forgot_password_subtitle')}</p>
      </div>

      <label className="space-y-1 text-sm text-slate-700">
        <span>{t('email')}</span>
        <input
          type="email"
          placeholder={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? t('please_wait') : t('send_reset_link')}
      </button>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <p className="text-sm text-slate-600">
        <Link className="font-semibold text-slate-900 underline-offset-2 hover:underline" href="/login">
          {t('back_to_login')}
        </Link>
      </p>
    </form>
  );
}
