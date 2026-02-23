import { cookies } from 'next/headers';
import { LANG_COOKIE, normalizeLanguage, type AppLanguage } from '@/lib/i18n';

export async function getServerLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get(LANG_COOKIE)?.value);
}
