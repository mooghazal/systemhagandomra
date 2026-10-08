import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';

import { ToastProvider } from '@hagamra/shared/components/ui/Toast';

import './globals.css';

/**
 * IBM Plex Sans Arabic covers Arabic and Latin in one family, so a company
 * name in Arabic and an email in Latin sit on the same baseline instead of
 * falling back to two unrelated fonts.
 */
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'لوحة الشركة | حجامرة',
    template: '%s | لوحة الشركة',
  },
  description: 'لوحة شركات الحج والعمرة',
  // An internal admin panel has no business appearing in a search index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
