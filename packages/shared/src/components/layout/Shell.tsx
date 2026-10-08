'use client';

import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useSession } from '../../hooks/useSession';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Primitives';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/Theme';

import { Rail, RailBrand, type RailSection } from './Rail';

/**
 * The frame every page renders inside, shared by both applications.
 *
 * Each passes its own navigation and its own name; the structure — a dark
 * rail, a quiet header, a content column — belongs here, so the admin panel
 * and the company dashboard stay recognisably the same product.
 *
 * The rail is permanent from `lg` up and a slide-over below it, so the panel
 * works on a phone without a second layout to maintain.
 */
export function Shell({
  sections,
  brandTitle,
  brandSubtitle,
  children,
}: {
  sections: RailSection[];
  brandTitle: string;
  brandSubtitle?: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useSession();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Leaving the drawer open across a navigation would cover the page that was
  // just opened.
  useEffect(() => setMenuOpen(false), [pathname]);

  // The drawer is a modal layer; the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Keyboard users should not have to tab the whole rail on every page to
          reach the content. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-[var(--radius-small)] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        تخطّي إلى المحتوى
      </a>

      <div className="flex">
        {/* -- Rail, permanent -------------------------------------------- */}
        <aside
          id="rail"
          // The seam goes on the rail's inline end — its left in Arabic, its
          // right in a left-to-right locale — which a fixed-offset shadow
          // cannot express.
          className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-rail-raised bg-rail lg:flex"
        >
          <RailBrand title={brandTitle} subtitle={brandSubtitle} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Rail sections={sections} />
          </div>
        </aside>

        {/* -- Rail, slide-over ------------------------------------------- */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            {/* The inline start, so the drawer arrives from the same side the
                permanent rail occupies on a wider screen. */}
            <aside className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-rail shadow-floating lg:hidden">
              <div className="flex items-center justify-between pe-2">
                <RailBrand title={brandTitle} subtitle={brandSubtitle} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="text-rail-muted hover:bg-rail-raised hover:text-rail-foreground"
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Rail sections={sections} onNavigate={() => setMenuOpen(false)} />
              </div>
            </aside>
          </>
        )}

        {/* -- Content ----------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              'sticky top-0 z-30 flex h-16 items-center justify-between gap-3',
              'border-b border-border-subtle bg-surface/85 px-4 backdrop-blur-md sm:px-6',
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="فتح القائمة"
              aria-expanded={menuOpen}
              aria-controls="rail"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>

            {/* Pushes the controls to the inline end on desktop, where the
                rail already carries the brand. */}
            <div className="flex-1" />

            <div className="flex items-center gap-2">
              <ThemeToggle />

              <span className="hidden h-6 w-px bg-border-subtle sm:block" aria-hidden="true" />

              <Link
                href="/profile"
                className="flex items-center gap-2.5 rounded-full py-1 pe-1 ps-2 transition-colors hover:bg-surface-muted"
              >
                <span className="hidden text-end sm:block">
                  <span className="block text-sm leading-tight font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="block text-xs leading-tight text-muted">{user.role_label}</span>
                </span>
                <Avatar name={user.name} accent="employees" />
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
                className="text-muted hover:bg-danger-soft hover:text-danger"
              >
                {!signingOut && <LogOut className="size-[18px]" aria-hidden="true" />}
              </Button>
            </div>
          </header>

          <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[90rem]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
