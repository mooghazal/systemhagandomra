'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '@hagamra/shared/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Only the two filled variants carry a shadow. Lifting every button flattens
 * the hierarchy again — the point of the shadow is that one action per screen
 * reads as the one to take.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover hover:shadow-raised',
  secondary: 'bg-surface-muted text-foreground border border-border-subtle hover:border-border-strong hover:bg-surface-sunken',
  outline: 'bg-surface text-foreground border border-border-strong hover:bg-surface-muted',
  ghost: 'bg-transparent text-muted-strong hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-danger text-white shadow-soft hover:bg-danger-hover hover:shadow-raised',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-10 px-4.5 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks further clicks while a request is in flight. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // Disabling while loading is what actually prevents a double submit
      // (spec §33) — a guard in the handler alone still lets the second click
      // register before state updates.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-base)] font-medium',
        'transition-all duration-150 select-none',
        // A press that moves is the cheapest confirmation that the click
        // landed, and it costs nothing to read.
        'active:translate-y-px active:shadow-none',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
