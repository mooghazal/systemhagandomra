import { NextResponse } from 'next/server';

import { apiUrl, clearToken, getToken } from '@hagamra/shared/lib/session';

/**
 * Ends the session.
 *
 * Laravel is told first so the token is revoked server-side — a cookie dropped
 * locally while the token stays valid is not a logout. The cookie is then
 * cleared regardless of what Laravel said: if the backend is unreachable or
 * the token was already dead, the person still ends up signed out here.
 */


export async function POST() {
  const token = await getToken();

  if (token) {
    try {
      await fetch(apiUrl('auth/logout'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'X-Client-Source': 'dashboard',
        },
        cache: 'no-store',
      });
    } catch {
      // Revocation failed; the cookie still goes. The token expires on its own.
    }
  }

  await clearToken();

  return NextResponse.json({ success: true, data: null });
}
