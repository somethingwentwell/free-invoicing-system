import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Sora } from 'next/font/google';
import { I18nProvider } from '@/components/i18n-provider';
import { getServerLanguage } from '@/lib/i18n-server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invoicing',
  description: 'Quotation, invoice, receipt workflow with Supabase.',
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
};

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body'
});

const headingFont = Sora({
  subsets: ['latin'],
  variable: '--font-heading'
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLanguage();

  return (
    <html lang={lang.startsWith('zh') ? 'zh' : 'en'}>
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
