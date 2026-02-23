'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LANG_COOKIE,
  LANG_STORAGE_KEY,
  normalizeLanguage,
  t,
  type AppLanguage
} from '@/lib/i18n';

interface I18nContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: AppLanguage; children: React.ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<AppLanguage>(initialLang);

  function setLang(next: AppLanguage) {
    const normalized = normalizeLanguage(next);
    setLangState(normalized);
    document.cookie = `${LANG_COOKIE}=${normalized}; Path=/; Max-Age=31536000; SameSite=Lax`;
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
    router.refresh();
  }

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => t(lang, key)
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
