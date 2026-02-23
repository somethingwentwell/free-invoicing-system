'use client';

import { useI18n } from '@/components/i18n-provider';
import type { AppLanguage } from '@/lib/i18n';

const OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'zh-TW', label: '繁中' },
  { value: 'zh-CN', label: '简中' }
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <select
      aria-label="Language"
      className="w-auto min-w-24 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
      value={lang}
      onChange={(event) => setLang(event.target.value as AppLanguage)}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
