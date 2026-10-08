'use client';

import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useState } from 'react';

import { cn } from '../../lib/cn';

import { Button } from './Button';

/** Surfaces, badges, tables and paging — the shared furniture of every screen. */

export function Card({
  className,
  children,
  elevated = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** Lifts the surface for something that should read as the subject of the page. */
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-base)] border border-border-subtle bg-surface',
        elevated ? 'shadow-raised' : 'shadow-soft',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The title block every screen opens with.
 *
 * An icon tile in the section's own colour sits beside the title, so the
 * reader knows which part of the system they are in before reading a word —
 * the same cue the rail gives, repeated where their eye actually lands.
 */
export function PageHeader({
  title,
  description,
  action,
  icon: Icon,
  accent = 'packages',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
  accent?: Accent;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span
            aria-hidden="true"
            style={accentStyle(accent)}
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-base)] bg-[var(--accent-soft)] text-[var(--accent)]"
          >
            <Icon className="size-[22px]" />
          </span>
        )}

        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      </div>

      {action}
    </div>
  );
}

/**
 * The sections of the system, each with its own colour.
 *
 * A glance at a card should say which part of the system it belongs to before
 * the label is read. The values come from CSS variables so both themes are
 * covered by one name.
 */
export type Accent =
  | 'packages'
  | 'hotels'
  | 'buses'
  | 'employees'
  | 'companies'
  | 'owners';

export const accentStyle = (accent: Accent): React.CSSProperties => ({
  '--accent': `var(--accent-${accent})`,
  '--accent-soft': `var(--accent-${accent}-soft)`,
} as React.CSSProperties);

type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted-strong border-border-subtle',
  success: 'bg-success-soft text-success border-success-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  info: 'bg-info-soft text-info border-info-border',
  primary: 'bg-primary-soft text-primary border-primary-border',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  /** A small status light, for state rather than category. */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * What to show where a value is simply absent.
 *
 * A package may have no price and a hotel no rating — that is valid data, not
 * missing data. An em dash says "not specified" without implying something
 * went wrong.
 */
export function Blank() {
  return (
    <span className="text-muted/70" title="غير محدّد">
      —
    </span>
  );
}

export function Value({ children }: { children: React.ReactNode }) {
  if (children === null || children === undefined || children === '') return <Blank />;

  return <>{children}</>;
}

// -- Table -------------------------------------------------------------------

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // Horizontal scroll rather than a squeezed table: on a phone a wide table
    // stays readable when it can be pushed sideways.
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-border-subtle bg-surface-muted/60 px-4 py-3 text-start',
        'text-[0.7rem] font-semibold tracking-wide text-muted uppercase whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-border-subtle px-4 py-3.5 align-middle', className)}>
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-surface-muted/70',
        // The last row sits on the card's own edge; a second line there reads
        // as a stray rule.
        '[&:last-child>td]:border-b-0',
        className,
      )}
    >
      {children}
    </tr>
  );
}

/** The primary cell of a row: a name, with something quieter beneath it. */
export function PrimaryCell({
  title,
  subtitle,
  ltrSubtitle = false,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  ltrSubtitle?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="block truncate font-medium text-foreground">{title}</span>
      {subtitle ? (
        <span className={cn('mt-0.5 block truncate text-xs text-muted', ltrSubtitle && 'ltr')}>
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

// -- Thumbnail ---------------------------------------------------------------

/**
 * An image that degrades instead of breaking.
 *
 * Three cases, all of which happen: no image was ever set, the file is gone
 * from storage, or it is still loading.
 */
export function Thumb({
  src,
  alt,
  className,
  size = 44,
}: {
  src: string | null;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const box = cn(
    'flex shrink-0 items-center justify-center overflow-hidden',
    'rounded-[var(--radius-small)] border border-border-subtle bg-surface-muted',
    className,
  );

  if (!src || failed) {
    return (
      <div
        className={box}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${alt} — لا توجد صورة`}
      >
        <ImageOff className="size-1/2 text-muted/60" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={box} style={{ width: size, height: size }}>
      {/* Plain <img>: these are user uploads served from Laravel's storage
          disk, which next/image would need an explicit remote pattern for and
          would gain nothing from optimising at thumbnail size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </div>
  );
}

/** A round monogram, for a person or a company with no picture. */
export function Avatar({
  name,
  size = 36,
  accent = 'packages',
  className,
}: {
  name: string;
  size?: number;
  accent?: Accent;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ ...accentStyle(accent), width: size, height: size }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        'bg-[var(--accent-soft)] text-[var(--accent)]',
        className,
      )}
    >
      <span style={{ fontSize: size * 0.42 }}>{name.trim().charAt(0) || '؟'}</span>
    </span>
  );
}

// -- Pagination --------------------------------------------------------------

export function Pagination({
  page,
  lastPage,
  total,
  perPage,
  onChange,
}: {
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-muted/40 px-4 py-3"
      aria-label="تنقّل بين الصفحات"
    >
      <p className="text-xs text-muted">
        عرض <span className="tabular font-semibold text-foreground">{from}</span>–
        <span className="tabular font-semibold text-foreground">{to}</span> من{' '}
        <span className="tabular font-semibold text-foreground">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="الصفحة السابقة"
        >
          {/* In RTL the "previous" arrow points right. */}
          <ChevronRight className="size-4" aria-hidden="true" />
          السابق
        </Button>

        <span className="tabular px-3 text-xs font-medium text-muted-strong">
          {page} / {lastPage}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          aria-label="الصفحة التالية"
        >
          التالي
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
