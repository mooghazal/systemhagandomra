import 'server-only';

import { redirect } from 'next/navigation';

import { apiUrl, clearToken, getToken } from '@hagamra/shared/lib/session';
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

    if (response.status === 401) {
      await clearToken();

      return null;
    }

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

  if (!session) redirect('/login');

  return session;
}
