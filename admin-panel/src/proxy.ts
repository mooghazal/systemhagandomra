import { NextRequest, NextResponse } from 'next/server';

import { NONCE_HEADER, buildCsp, createNonce } from '@hagamra/shared/lib/csp';

/**
 * The first gate on every page (spec §7).
 *
 * Next calls this a proxy; it used to be called middleware, and the file had
 * to be renamed with it. Not to be confused with lib/laravel-proxy in the
 * shared package, which forwards API calls to Laravel — this one never leaves
 * the edge and only decides whether a page is allowed to render at all.
 *
 * It checks only that a session cookie exists — whether that token is still
 * valid is Laravel's call, and the layout asks it on every load. A cheap check
 * here keeps a signed-out visitor from ever rendering the shell.
 *
 * This is convenience and UX, not security: the cookie is opaque to the
 * browser and every piece of data behind it is fetched with Laravel checking
 * the token afresh.
 */

/* Must match SESSION_COOKIE_NAME in the shared session module: two apps on
   localhost share a cookie jar, because browsers ignore the port. */
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'hagamra_token';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(COOKIE_NAME)?.value);

  /*
   * A nonce for this request, and the policy that names it.
   *
   * It has to be made here rather than in next.config because it must be new
   * every time — a nonce an attacker can predict is not a nonce. The layout
   * reads it back off the request header to put on its one inline script, and
   * Next puts it on the scripts it emits itself.
   */
  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'production');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);

  const withPolicy = (response: NextResponse): NextResponse => {
    response.headers.set('Content-Security-Policy', csp);

    return response;
  };

  const onwards = () => withPolicy(NextResponse.next({ request: { headers: requestHeaders } }));

  if (pathname === '/login') {
    return signedIn
      ? withPolicy(NextResponse.redirect(new URL('/', request.url)))
      : onwards();
  }

  if (!signedIn) {
    const login = new URL('/login', request.url);

    // Remember where they were headed so the login can return them there.
    if (pathname !== '/') login.searchParams.set('next', pathname + search);

    return withPolicy(NextResponse.redirect(login));
  }

  return onwards();
}

export const config = {
  /*
   * Everything except Next's own assets, this app's API routes, and the
   * files the browser fetches on its own.
   *
   * The API routes are excluded because they answer with a 401 of their own;
   * redirecting a fetch() to an HTML login page would hand the client markup
   * where it expected JSON.
   *
   * icon.svg is excluded because the browser asks for it without a session —
   * most visibly on the login page, where there is not supposed to be one.
   * Without it the tab icon redirected to /login and the tab sat blank on the
   * one screen every visitor starts from.
   */
  matcher: ['/((?!api|_next/static|_next/image|icon\.svg|favicon\.ico).*)'],
};
