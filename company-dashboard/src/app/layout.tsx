import type { Metadata } from 'next';
import { Readex_Pro } from 'next/font/google';

import { ThemeProvider, themeScript } from '@hagamra/shared/components/ui/Theme';
import { ToastProvider } from '@hagamra/shared/components/ui/Toast';

import './globals.css';

/**
 * One family for both scripts, so a company name in Arabic and an e-mail in
 * Latin sit on the same baseline instead of falling back to two unrelated
 * fonts mid-sentence.
 *
 * Readex Pro is a variable font, which is why no weight list is given: every
 * weight between 200 and 700 is available from a single file, so a heading can
 * be 650 rather than rounded to the nearest one that happened to be
 * downloaded.
 */
const arabic = Readex_Pro({
  subsets: ['arabic', 'latin'],
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
