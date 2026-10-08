import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { apiUrl, getToken, setToken } from './session';

/**
 * The account holder changing their own password.
 *
 * This exists as its own route, rather than going through the Laravel proxy,
 * for the same reason sign-in does: the response carries a replacement token.
 * Laravel revokes every session when a password changes — which is the point,
 * since the usual reason for changing one is that somebody else has it — and
 * the caller needs a new one or they are signed out of the tab they are
 * standing in.
 *
 * Relayed through the proxy, that token would arrive in the browser as JSON,
 * where a script could read it. Here it goes straight into the httpOnly
 * cookie and the body carries nothing but success.
 *
 * The passwords themselves are forwarded and never stored, logged or kept.
 */
export function changePasswordRoute(deviceName: string) {
  return async function POST(request: NextRequest) {
    const token = await getToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Unauthenticated.' },
        { status: 401 },
      );
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request.' }, { status: 400 });
    }

    const { current_password: current, password, password_confirmation: confirmation } =
      (payload ?? {}) as Record<string, unknown>;

    if (
      typeof current !== 'string'
      || typeof password !== 'string'
      || typeof confirmation !== 'string'
    ) {
      return NextResponse.json(
        { success: false, message: 'Missing fields.' },
        { status: 422 },
      );
    }

    let upstream: Response;

    try {
      upstream = await fetch(apiUrl('auth/password'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'ar',
          'X-Client-Source': 'dashboard',
        },
        body: JSON.stringify({
          current_password: current,
          password,
          password_confirmation: confirmation,
          device_name: deviceName,
        }),
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
      // Laravel's wording passes through: it already distinguishes a wrong
      // current password from one that fails the policy, in the caller's
      // language.
      return NextResponse.json(
        {
          success: false,
          message: body?.message ?? 'Unable to change the password.',
          errors: body?.errors,
        },
        { status: upstream.status },
      );
    }

    await setToken(body.data.token as string);

    return NextResponse.json({ success: true, data: null });
  };
}
