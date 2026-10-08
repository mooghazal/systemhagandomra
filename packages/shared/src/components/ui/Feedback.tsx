'use client';

import { AlertTriangle, Inbox, Loader2, Lock, RefreshCw } from 'lucide-react';

import { cn } from '@hagamra/shared/lib/cn';

import { Button } from './Button';

/**
 * The three states every data screen needs besides "here are the rows":
 * loading, nothing yet, and something went wrong (spec §36, §37, §38).
 *
 * They live together because they are one decision — what to render instead of
 * a table — and keeping them apart invites a screen that handles two of the
 * three and blanks on the other.
 */

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('size-5 animate-spin text-muted', className)}
      role="status"
      aria-label="جارٍ التحميل"
    />
  );
}

export function LoadingBlock({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16">
      <Spinner className="size-7" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/**
 * Placeholder rows that match the table's shape, so the layout does not jump
 * when real data replaces them.
 */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-[var(--border)]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className="shimmer h-4 flex-1 rounded-full"
              style={{
                maxWidth: columnIndex === 0 ? '12rem' : undefined,
                // Staggered, so the sweep crosses the table rather than every
                // cell flashing in lockstep.
                animationDelay: `${(rowIndex * columns + columnIndex) * 45}ms`,
              }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">جارٍ تحميل البيانات</span>
    </div>
  );
}

/**
 * The circular mark the empty and error states are built around.
 *
 * A ring around the disc rather than a flat circle: it gives the icon a little
 * depth at no cost, and keeps the two states visually matched.
 */
function StateIcon({
  icon: Icon,
  className,
}: {
  icon: React.ElementType;
  className: string;
}) {
  return (
    <div
      className={cn(
        'flex size-14 items-center justify-center rounded-full ring-8',
        className,
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="animate-fade flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <StateIcon icon={Icon} className="bg-surface-muted text-muted ring-surface-sunken/60" />

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * A failure the person can do something about.
 *
 * The message comes from the API layer, which has already translated a status
 * code into a sentence. A raw 500 or a stack trace never reaches here (§38).
 */
export function ErrorState({
  message,
  onRetry,
  forbidden = false,
}: {
  message: string;
  onRetry?: () => void;
  forbidden?: boolean;
}) {
  const Icon = forbidden ? Lock : AlertTriangle;

  return (
    <div className="animate-fade flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <StateIcon
        icon={Icon}
        className={
          forbidden
            ? 'bg-warning-soft text-warning ring-[var(--warning-soft)]/50'
            : 'bg-danger-soft text-danger ring-[var(--danger-soft)]/50'
        }
      />

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">
          {forbidden ? 'غير مصرّح' : 'تعذّر إتمام العملية'}
        </h3>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted" role="alert">
          {message}
        </p>
      </div>

      {/* A permission refusal will not change on a retry, so no button. */}
      {onRetry && !forbidden && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="size-4" aria-hidden="true" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
