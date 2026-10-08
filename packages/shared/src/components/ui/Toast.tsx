'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@hagamra/shared/lib/cn';

/**
 * Transient confirmations and failures (spec §40).
 *
 * The container is an aria-live region, so a toast is announced rather than
 * only seen. Errors use `assertive` because they interrupt what someone is
 * doing; successes use `polite` and wait their turn.
 */

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * The layer every toast is drawn in. Named, because a modal dialog has to be
 * able to tell a click on a toast apart from a click on its own backdrop.
 */
export const TOAST_LAYER_ID = 'toast-layer';

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }

  return context;
}

/**
 * A toast sits on the panel's own surface with a coloured bar down its inline
 * start, rather than being a block of tinted colour. A fully tinted card at
 * this size competes with the page; a bar reads as a status at a glance and
 * leaves the message on a neutral background where it is easiest to read.
 */
const STYLES: Record<ToastKind, { bar: string; icon: React.ElementType; tint: string }> = {
  success: { bar: 'bg-success', tint: 'text-success', icon: CheckCircle2 },
  error: { bar: 'bg-danger', tint: 'text-danger', icon: AlertCircle },
  info: { bar: 'bg-info', tint: 'text-info', icon: Info },
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const layer = useRef<HTMLDivElement>(null);

  // The layer only joins the top layer while it has something to show. Keeping
  // it there permanently would put it above a dialog opened afterwards, so an
  // empty strip would sit over the form.
  useEffect(() => {
    const element = layer.current;

    if (!element) return;

    try {
      if (toasts.length > 0) {
        // Re-showing moves it back to the front of the top layer, which is
        // what makes a toast land above a dialog opened since the last one.
        if (element.matches(':popover-open')) element.hidePopover();

        element.showPopover();
      } else if (element.matches(':popover-open')) {
        element.hidePopover();
      }
    } catch {
      // Without popover support the layer stays an ordinary fixed element:
      // visible on every screen except over an open dialog.
    }
  }, [toasts]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;

      setToasts((current) => [...current, { id, kind, message }]);

      // Errors linger: they usually carry something to read and act on.
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/*
        A manual popover, not a plain fixed layer.

        A modal <dialog> sits in the browser's top layer, which is above every
        z-index there is — so a toast fired while a form is open was painted
        underneath it and nobody ever saw it. That is most of the messages that
        matter: a save refused by the server, a lost connection, a file too
        large. A popover joins the same top layer, and because it is shown at
        the moment a toast appears it lands above the dialog that is already
        there.
      */}
      <div
        ref={layer}
        id={TOAST_LAYER_ID}
        popover="manual"
        className={cn(
          'pointer-events-none flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2',
          // The popover UA style centres the element and gives it a border and
          // padding; none of that belongs on a stack of toasts.
          'fixed inset-auto bottom-4 start-4 m-0 border-0 bg-transparent p-0',
        )}
        role="region"
        aria-label="الإشعارات"
      >
        {toasts.map((toast) => {
          const { bar, tint, icon: Icon } = STYLES[toast.kind];

          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'animate-slide-in pointer-events-auto relative flex items-start gap-3 overflow-hidden',
                'rounded-[var(--radius-base)] border border-border-subtle bg-surface',
                'py-3.5 pe-3 ps-5 shadow-floating',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('absolute inset-y-0 start-0 w-1', bar)}
              />

              <Icon className={cn('mt-0.5 size-5 shrink-0', tint)} aria-hidden="true" />
              <p className="flex-1 text-sm leading-6 text-foreground">{toast.message}</p>

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                aria-label="إغلاق الإشعار"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
