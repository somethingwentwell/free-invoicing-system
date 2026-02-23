'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n-provider';
import { createClient } from '@/lib/supabase/client';

interface Props {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showEmailConfirmPopup, setShowEmailConfirmPopup] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const emailRedirectTo =
      process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL?.trim() ||
      (typeof window !== 'undefined' ? `${window.location.origin}/login` : '');

    const action =
      mode === 'register'
        ? supabase.auth.signUp({
            email,
            password,
            options: emailRedirectTo ? { emailRedirectTo } : undefined
          })
        : supabase.auth.signInWithPassword({ email, password });

    const { data, error } = await action;
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === 'register') {
      if (!data.session) {
        setShowEmailConfirmPopup(true);
        setMessage(t('auth_success_confirm'));
        return;
      }

      setMessage(t('auth_success_login'));
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  function onEnterSubmit(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || loading) return;
    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="surface mx-auto flex w-full max-w-md flex-col gap-4 p-7 md:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === 'register' ? t('auth_create_account') : t('auth_welcome_back')}
        </h1>
        <p className="text-sm text-slate-500">
          {mode === 'register'
            ? t('auth_register_subtitle')
            : t('auth_login_subtitle')}
        </p>
      </div>
      <label className="space-y-1 text-sm text-slate-700">
        <span>{t('email')}</span>
        <input
          type="email"
          placeholder={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onEnterSubmit}
          required
        />
      </label>
      <label className="space-y-1 text-sm text-slate-700">
        <span>{t('password')}</span>
        <input
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onEnterSubmit}
          required
        />
      </label>
      {mode === 'login' ? (
        <p className="-mt-2 text-right text-sm">
          <Link className="font-semibold text-slate-900 underline-offset-2 hover:underline" href="/forgot-password">
            {t('forgot_password')}
          </Link>
        </p>
      ) : null}
      <button className="mt-1" disabled={loading} type="submit">
        {loading ? t('please_wait') : mode === 'register' ? t('auth_create_account') : t('sign_in')}
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {showEmailConfirmPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">{t('auth_confirm_email_title')}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t('auth_confirm_email_desc')}
            </p>
            <button
              type="button"
              className="mt-4 w-full"
              onClick={() => setShowEmailConfirmPopup(false)}
            >
              {t('i_understand')}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
