'use client';

import { X } from 'lucide-react';

import { Button } from '@hagamra/shared/components/ui/Button';

/**
 * The strip that appears once rows are ticked.
 *
 * It sits above the table rather than floating over it: a bar pinned to the
 * bottom of the window covers the last row, which is exactly the row somebody
 * scrolled down to reach.
 *
 * It states the count in words rather than only showing buttons, because the
 * number is the thing a person needs to check before pressing something that
 * applies to all of them.
 */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  /** The actions. Destructive ones confirm for themselves. */
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div
      // Announced, because it appears without the page moving — somebody
      // using a screen reader would otherwise not know it had.
      role="status"
      aria-live="polite"
      className="animate-fade mb-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-base)] border border-primary-border bg-primary-soft px-4 py-2.5"
    >
      <span className="text-sm font-medium text-primary">
        {count === 1 ? 'عنصر واحد محدّد' : `${count} عناصر محدّدة`}
      </span>

      <div className="flex flex-wrap items-center gap-2">{children}</div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="ms-auto text-muted hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
        إلغاء التحديد
      </Button>
    </div>
  );
}

/**
 * The header checkbox, which has three states rather than two.
 *
 * `indeterminate` is a DOM property with no HTML attribute, so it can only be
 * set through a ref. Without it, "three of fifteen ticked" renders as an empty
 * box — which reads as "nothing is selected" while a bulk action is armed.
 */
export function SelectAllTh({
  all,
  some,
  onToggle,
}: {
  all: boolean;
  some: boolean;
  onToggle: () => void;
}) {
  return (
    <th scope="col" className="w-10 border-b border-border-subtle bg-surface-muted/50 ps-4">
      <input
        type="checkbox"
        checked={all}
        ref={(node) => {
          if (node) node.indeterminate = some;
        }}
        onChange={onToggle}
        aria-label={all ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
        className="size-4 cursor-pointer rounded border-border-strong accent-[var(--primary)]"
      />
    </th>
  );
}

/** A row's checkbox. */
export function SelectTd({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  /** The record's name, so the box is not announced as a bare "checkbox". */
  label: string;
}) {
  return (
    <td className="border-b border-border-subtle ps-4 align-middle">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`تحديد ${label}`}
        className="size-4 cursor-pointer rounded border-border-strong accent-[var(--primary)]"
      />
    </td>
  );
}
