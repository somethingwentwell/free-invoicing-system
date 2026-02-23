'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { createClient } from '@/lib/supabase/client';

export function ResetPasswordForm() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setMessage('');

    if (password !== confirmPassword) {
      setMessage(t('password_mismatch'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(t('password_updated'));
    router.push('/login');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="surface mx-auto flex w-full max-w-md flex-col gap-4 p-7 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">{t('reset_password_title')}</h1>
        <p className="text-sm text-slate-500">{t('reset_password_subtitle')}</p>
      </div>

      <label className="space-y-1 text-sm text-slate-700">
        <span>{t('new_password')}</span>
        <input
          type="password"
          placeholder={t('new_password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      <label className="space-y-1 text-sm text-slate-700">
        <span>{t('confirm_password')}</span>
        <input
          type="password"
          placeholder={t('confirm_password')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? t('please_wait') : t('update_password')}
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
