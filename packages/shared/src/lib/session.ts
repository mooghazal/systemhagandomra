import 'server-only';

import { cookies } from 'next/headers';

/**
 * The access token lives in an httpOnly cookie and nowhere else.
 *
 * Nothing in the browser can read it: not application code, not a third-party
 * script, not an injected one. That is the whole point — a token kept in
 * localStorage is one XSS away from being someone else's.
 *
 * Everything here is server-only; importing it from a Client Component is a
 * build error rather than a silent leak.
 */

/**
 * Each application names its own cookie.
 *
 * Browsers scope cookies by host and ignore the port, so two apps served from
 * localhost on different ports share one jar — signing into the admin panel
 * would hand its session to the company dashboard and vice versa. Distinct
 * names keep the two apart in development; in production they sit on separate
 * hosts and would not collide anyway.
 */
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'hagamra_token';

function lifetimeSeconds(): number {
  const minutes = Number(process.env.SESSION_LIFETIME_MINUTES ?? 480);

  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 480) * 60;
}

export async function getToken(): Promise<string | null> {
  const store = await cookies();

  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setToken(token: string): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Not sent on cross-site navigations, which is what makes a CSRF attempt
    // against this panel arrive without credentials.
    sameSite: 'lax',
    /*
     * Secure by default in production.
     *
     * Reading `COOKIE_SECURE === '1'` alone fails open: a deploy that forgets
     * the variable serves the session cookie over plain HTTP, which is the one
     * mistake this flag exists to prevent. Production is secure unless
     * someone explicitly says otherwise, and local http development — where
     * a secure cookie is simply never stored — still works untouched.
     */
    secure:
      process.env.COOKIE_SECURE === '1' ||
      (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0'),
    path: '/',
    maxAge: lifetimeSeconds(),
  });
}

export async function clearToken(): Promise<void> {
  const store = await cookies();

  store.delete(COOKIE_NAME);
}

export function apiUrl(path = ''): string {
  const base = (process.env.API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '');

  return path ? `${base}/${path.replace(/^\/+/, '')}` : base;
}
