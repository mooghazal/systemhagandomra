import 'server-only';

import { redirect } from 'next/navigation';

import { apiUrl, getToken } from '@hagamra/shared/lib/session';
import type { ApiEnvelope, Session } from '@hagamra/shared/types';

/**
 * Server-side reads, used by layouts and pages before anything renders.
 *
 * This talks to Laravel directly rather than going through /api/laravel: the
 * proxy exists to give the *browser* a way to send a token it cannot read, and
 * on the server the token is already in hand.
 */

export async function serverGet<T>(path: string): Promise<T | null> {
  const token = await getToken();

  if (!token) return null;

  try {
    const response = await fetch(apiUrl(path), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': 'ar',
        'X-Client-Source': 'dashboard',
      },
      cache: 'no-store',
    });

    // The dead cookie is cleared by the route this redirects to, not here:
    // a Server Component cannot write a cookie, and the attempt throws into
    // the catch below where it was silently swallowed.
    if (response.status === 401) return null;

    if (!response.ok) return null;

    const envelope = (await response.json()) as ApiEnvelope<T>;

    return envelope.success ? envelope.data : null;
  } catch {
    // The backend being down must not crash the shell; callers decide what to
    // render instead.
    return null;
  }
}

/**
 * The signed-in user and their effective permissions, or a redirect to login.
 *
 * Called by the admin layout on every navigation, which is what makes a
 * revoked token take effect immediately rather than whenever the panel next
 * happens to make a request.
 */
export async function requireSession(): Promise<Session> {
  const session = await serverGet<Session>('auth/me');

  /*
   * Via the route handler rather than straight to /login, because the cookie
   * has to go first and only a route handler may delete it.
   *
   * Sending them to /login directly locked them out of the panel entirely: the
   * stale cookie was still there, so the middleware read it as signed in and
   * bounced /login back to /, which came here again. The two redirected to
   * each other until the browser gave up with ERR_TOO_MANY_REDIRECTS, and no
   * route was left that could clear the cookie.
   */
  if (!session) redirect('/api/auth/expired');

  return session;
}
