'use client';

import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@hagamra/shared/components/ui/Button';
import { Sidebar } from '@/components/layout/Sidebar';
import { useSession } from '@hagamra/shared/hooks/useSession';
import { cn } from '@hagamra/shared/lib/cn';

/**
 * The frame every admin page renders inside (spec §9).
 *
 * The sidebar is permanent from `lg` up and a slide-over below it, so the
 * panel stays usable on a phone without a second layout to maintain (§43).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Leaving the drawer open across a navigation would cover the page that was
  // just opened.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Keyboard users should not have to tab the whole sidebar on every
          page to reach the content (§45). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        تخطّي إلى المحتوى
      </a>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </Button>

          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
              ح
            </span>
            <span className="hidden text-base font-bold text-foreground sm:block">
              لوحة التحكم
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-[var(--radius-base)] px-2 py-1.5 transition-colors hover:bg-surface-muted"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {user.name.charAt(0)}
            </span>
            <span className="hidden text-start sm:block">
              <span className="block text-sm leading-tight font-medium text-foreground">
                {user.name}
              </span>
              <span className="block text-xs leading-tight text-muted">{user.role_label}</span>
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              setSigningOut(true);
              await logout();
            }}
            loading={signingOut}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            {!signingOut && <LogOut className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </header>

      <div className="flex">
        <aside
          id="sidebar"
          className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-s-0 border-e border-border-subtle bg-surface lg:block"
        >
          <Sidebar />
        </aside>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 top-16 z-20 bg-black/40 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <aside
              className={cn(
                'fixed top-16 bottom-0 end-0 z-30 w-64 overflow-y-auto border-e border-border-subtle bg-surface lg:hidden',
              )}
            >
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </aside>
          </>
        )}

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
