'use client';

import { forwardRef, useId } from 'react';

import { cn } from '@hagamra/shared/lib/cn';

/**
 * Form inputs that are accessible by construction.
 *
 * The label is tied to the control, the error is announced, and
 * `aria-invalid` is set — so a screen reader hears the same thing a sighted
 * person sees, rather than a red border that means nothing to them (§45).
 */

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => React.ReactNode;
}

export function Field({ label, error, hint, required, className, children }: FieldShellProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="text-danger ms-1" aria-hidden="true">*</span>
        ) : (
          <span className="text-muted text-xs font-normal ms-2">(اختياري)</span>
        )}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">{hint}</p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

const CONTROL = [
  'w-full rounded-[var(--radius-base)] border bg-surface px-3 py-2 text-sm',
  'text-foreground transition-colors',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted',
  'aria-[invalid=true]:border-danger',
].join(' ');

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-10', className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(CONTROL, 'resize-y', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL, 'h-10 cursor-pointer', className)} {...props}>
        {children}
      </select>
    );
  },
);

/**
 * A number input that reports an empty box as `null` rather than `0` or `NaN`.
 *
 * This matters more than it looks: the backend treats "no price" and "a price
 * of zero" as different facts (spec §15), so clearing a field must clear it,
 * not quietly set it to zero.
 */
export const NumberInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    value: number | null;
    onChange: (value: number | null) => void;
  }
>(function NumberInput({ className, value, onChange, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === '' ? null : Number(raw));
      }}
      className={cn(CONTROL, 'h-10 tabular', className)}
      {...props}
    />
  );
});

export function Checkbox({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const id = useId();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="checkbox"
        className="size-4 shrink-0 cursor-pointer rounded border-border-strong accent-[var(--primary)]"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-foreground select-none">
        {label}
      </label>
    </div>
  );
}
