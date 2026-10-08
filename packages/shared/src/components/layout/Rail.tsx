'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '../../lib/cn';
import { type Accent, accentStyle } from '../ui/Primitives';

/**
 * The navigation rail, shared by both applications.
 *
 * Dark in both themes. It anchors the page — a light rail against a light
 * canvas leaves the eye nothing to hold, and the whole screen reads as one
 * undifferentiated sheet.
 *
 * Each application passes its own items; what lives here is how they look and
 * behave, so the two panels stay recognisably one system.
 */

export interface RailItem {
  href: string;
  label: string;
  icon: React.ElementType;
  accent: Accent;
}

export interface RailSection {
  /** Omitted for the first group, which needs no heading. */
  title?: string;
  items: RailItem[];
}

export function Rail({
  sections,
  onNavigate,
}: {
  sections: RailSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="القائمة الرئيسية" className="flex h-full flex-col gap-6 px-3 py-4">
      {sections.map((section, index) => (
        <div key={section.title ?? index} className="flex flex-col gap-1">
          {section.title && (
            <h2 className="px-3 pb-1 text-[0.68rem] font-semibold tracking-wider text-rail-muted uppercase">
              {section.title}
            </h2>
          )}

          {section.items.map((item) => {
            // `/` would otherwise light up on every route.
            const active = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                style={accentStyle(item.accent)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-[var(--radius-small)]',
                  'px-3 py-2.5 text-sm transition-colors duration-150',
                  active
                    ? 'bg-rail-active font-semibold text-rail-foreground'
                    : 'text-rail-muted hover:bg-rail-raised hover:text-rail-foreground',
                )}
              >
                {/* A marker on the inline-start edge, which RTL puts on the
                    right where the eye starts. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-y-1.5 start-0 w-[3px] rounded-full transition-all',
                    active ? 'bg-[var(--accent)] opacity-100' : 'opacity-0',
                  )}
                />

                <Icon
                  className={cn(
                    'size-[18px] shrink-0 transition-colors',
                    active ? 'text-[var(--accent)]' : 'text-rail-muted group-hover:text-rail-foreground',
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** The product mark at the top of the rail. */
export function RailBrand({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-5 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-small)] bg-primary text-lg font-bold text-primary-foreground">
        ح
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-rail-foreground">{title}</span>
        {subtitle && (
          <span className="block truncate text-[0.7rem] text-rail-muted">{subtitle}</span>
        )}
      </span>
    </Link>
  );
}
