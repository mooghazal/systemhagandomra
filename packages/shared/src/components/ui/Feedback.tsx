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
              className="h-4 flex-1 animate-pulse rounded bg-[var(--border)]"
              style={{ maxWidth: columnIndex === 0 ? '12rem' : undefined }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">جارٍ تحميل البيانات</span>
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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="rounded-full bg-surface-muted p-3">
        <Icon className="size-6 text-muted" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
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
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className={cn('rounded-full p-3', forbidden ? 'bg-warning-soft' : 'bg-danger-soft')}>
        <Icon
          className={cn('size-6', forbidden ? 'text-warning' : 'text-danger')}
          aria-hidden="true"
        />
      </div>

      <p className="max-w-md text-sm text-muted-strong" role="alert">
        {message}
      </p>

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
