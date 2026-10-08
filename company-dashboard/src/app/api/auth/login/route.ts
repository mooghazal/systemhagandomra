import { NextRequest, NextResponse } from 'next/server';

import { apiUrl, setToken } from '@hagamra/shared/lib/session';

/**
 * Exchanges credentials for a session cookie.
 *
 * The password is forwarded to Laravel and never stored, logged or kept here.
 * The token Laravel returns goes straight into an httpOnly cookie and is
 * deliberately *not* included in the response body — the browser has no reason
 * to see it, and anything that cannot be read cannot be stolen by a script.
 */


export async function POST(request: NextRequest) {
  let credentials: unknown;

  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request.' },
      { status: 400 },
    );
  }

  const { email, password } = (credentials ?? {}) as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { success: false, message: 'Email and password are required.' },
      { status: 422 },
    );
  }

  let upstream: Response;

  try {
    upstream = await fetch(apiUrl('auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'ar',
        'X-Client-Source': 'dashboard',
      },
      body: JSON.stringify({ email, password, device_name: 'admin-panel' }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Could not reach the server. Please try again.' },
      { status: 502 },
    );
  }

  const body = await upstream.json().catch(() => null);

  if (!upstream.ok || !body?.success) {
    // Laravel's wording is passed through as-is. It is deliberately the same
    // for an unknown address and a wrong password, so this must not try to be
    // more helpful than the backend intends.
    return NextResponse.json(
      {
        success: false,
        message: body?.message ?? 'Unable to sign in.',
        errors: body?.errors,
      },
      { status: upstream.status },
    );
  }

  await setToken(body.data.token as string);

  // The user object travels back so the panel can render immediately; the
  // token does not.
  return NextResponse.json({ success: true, data: { user: body.data.user } });
}
