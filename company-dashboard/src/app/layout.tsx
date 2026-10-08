import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';

import { ThemeProvider, themeScript } from '@hagamra/shared/components/ui/Theme';
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
    // suppressHydrationWarning: the inline script below sets data-theme before
    // React runs, so the server markup and the first client render differ here
    // by design.
    <html lang="ar" dir="rtl" className={arabic.variable} suppressHydrationWarning>
      <head>
        {/*
          * Runs before the first paint. Without it the page renders light and
          * then corrects itself — a white flash on every navigation for anyone
          * using dark mode.
          */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
