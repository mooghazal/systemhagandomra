'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@hagamra/shared/lib/cn';

import { Button } from './Button';

/**
 * Built on the native <dialog>, which brings focus trapping, Escape handling
 * and inertness of the page behind it for free — all of which are easy to
 * reimplement badly and hard to reimplement correctly (§45).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // The page behind must not scroll under the dialog.
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

  return (
    <dialog
      ref={ref}
      // Escape fires `cancel`; routing it through onClose keeps the parent's
      // state in step with what is actually on screen.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop means the <dialog> itself is the target.
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'w-[calc(100vw-2rem)] rounded-[var(--radius-base)] border border-border-subtle bg-surface p-0',
        'text-foreground shadow-xl backdrop:bg-black/40',
        'm-auto',
        widths[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
        <div>
          <h2 id="dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {children && <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>}

      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle bg-surface-muted px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/**
 * Guards every destructive action (spec §39).
 *
 * The item's name is repeated back so there is no doubt about what is about to
 * go, and the confirm button carries the danger styling rather than sitting
 * where "OK" usually does.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'تأكيد الحذف',
  itemName,
  message,
  confirmLabel = 'حذف',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-strong">
        {message ?? (
          <>
            هل أنت متأكد من حذف{' '}
            {itemName ? <span className="font-semibold text-foreground">«{itemName}»</span> : 'هذا العنصر'}؟
          </>
        )}
      </p>
    </Dialog>
  );
}
