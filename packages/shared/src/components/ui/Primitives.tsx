'use client';

import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@hagamra/shared/lib/cn';

import { Button } from './Button';

/** Surfaces, badges, tables and paging — the shared furniture of every screen. */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-[var(--radius-base)] border border-border-subtle bg-surface', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-muted-strong border-border-subtle',
  success: 'bg-success-soft text-success border-success/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  info: 'bg-info-soft text-info border-info/20',
  primary: 'bg-primary-soft text-primary border-primary/20',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * What to show where a value is simply absent.
 *
 * A package may have no price and a hotel no rating — that is valid data, not
 * missing data (spec §19). An em dash says "not specified" without implying
 * something went wrong.
 */
export function Blank() {
  return (
    <span className="text-muted" title="غير محدّد">
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
    // stays readable when it can be pushed sideways (§43).
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
        'border-b border-border-subtle bg-surface-muted px-4 py-3 text-start',
        'text-xs font-semibold tracking-wide text-muted-strong whitespace-nowrap',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-border-subtle px-4 py-3 align-middle', className)}>
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn('transition-colors hover:bg-surface-muted/60', className)}>{children}</tr>;
}

// -- Thumbnail ---------------------------------------------------------------

/**
 * An image that degrades instead of breaking.
 *
 * Three cases, all of which happen: no image was ever set, the file is gone
 * from storage, or it is still loading (spec §48).
 */
export function Thumb({
  src,
  alt,
  className,
  size = 40,
}: {
  src: string | null;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const box = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-surface-muted',
    className,
  );

  if (!src || failed) {
    return (
      <div className={box} style={{ width: size, height: size }} role="img" aria-label={`${alt} — لا توجد صورة`}>
        <ImageOff className="size-1/2 text-muted" aria-hidden="true" />
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
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3"
      aria-label="تنقّل بين الصفحات"
    >
      <p className="text-xs text-muted">
        عرض <span className="tabular font-medium text-foreground">{from}</span>–
        <span className="tabular font-medium text-foreground">{to}</span> من{' '}
        <span className="tabular font-medium text-foreground">{total}</span>
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

        <span className="tabular px-3 text-xs text-muted">
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
