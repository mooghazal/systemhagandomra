'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';

/**
 * Light and dark, with the reader's choice remembered.
 *
 * Three settings rather than two: light, dark, and following the system. The
 * third is the sensible default — someone whose machine turns dark in the
 * evening expects this to come with it — but it has to be a real option, or
 * choosing light in the morning silently opts out of the system forever.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hagamra_theme';

interface ThemeApi {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

export function useTheme(): ThemeApi {
  const context = useContext(ThemeContext);

  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');

  return context;
}

/**
 * Runs before the first paint, inlined in the document head.
 *
 * Without it the page renders light, then corrects itself once React starts —
 * a white flash on every single navigation for anyone using dark mode. It
 * writes the attribute the stylesheet keys on, which is also why the CSS needs
 * no media query of its own.
 *
 * Deliberately tiny and defensive: storage throws in a private window, and a
 * failure here must not stop the page rendering.
 */
export const themeScript = `(function(){try{
var p=localStorage.getItem('${STORAGE_KEY}')||'system';
var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

function systemIsDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(preference: ThemePreference): 'light' | 'dark' {
  const resolved = preference === 'system'
    ? (systemIsDark() ? 'dark' : 'light')
    : preference;

  document.documentElement.setAttribute('data-theme', resolved);

  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Starts at the server-rendered default; the effect below reconciles it with
  // what the inline script already put on the document.
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let stored: ThemePreference = 'system';

    try {
      const value = localStorage.getItem(STORAGE_KEY);

      if (value === 'light' || value === 'dark' || value === 'system') stored = value;
    } catch {
      // Private browsing, or storage disabled. The default stands.
    }

    setPreferenceState(stored);
    setResolved(apply(stored));
  }, []);

  // While following the system, track it as it changes — someone on an
  // automatic schedule should not have to reload at sunset.
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(apply('system'));

    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setResolved(apply(next));

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this tab; it simply will not be remembered.
    }
  }, []);

  const value = useMemo<ThemeApi>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: React.ElementType }> = [
  { value: 'light', label: 'فاتح', icon: Sun },
  { value: 'dark', label: 'داكن', icon: Moon },
  { value: 'system', label: 'حسب النظام', icon: Monitor },
];

/**
 * A three-way switch rather than a toggle, so "follow the system" stays
 * reachable after someone has picked a side.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="سمة الألوان"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-surface-muted p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full transition-all',
              active
                ? 'bg-surface text-primary shadow-soft'
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon className="size-[15px]" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
