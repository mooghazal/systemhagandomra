'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }

  return context;
}

const STYLES: Record<ToastKind, { box: string; icon: React.ElementType }> = {
  success: { box: 'bg-success-soft border-success/30 text-success', icon: CheckCircle2 },
  error: { box: 'bg-danger-soft border-danger/30 text-danger', icon: AlertCircle },
  info: { box: 'bg-info-soft border-info/30 text-info', icon: Info },
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

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

      <div
        className="pointer-events-none fixed bottom-4 start-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="region"
        aria-label="الإشعارات"
      >
        {toasts.map((toast) => {
          const { box, icon: Icon } = STYLES[toast.kind];

          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-[var(--radius-base)] border px-4 py-3 shadow-lg',
                box,
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm leading-6">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
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
