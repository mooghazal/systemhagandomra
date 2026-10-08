import { NextRequest, NextResponse } from 'next/server';

/**
 * The first gate on every page (spec §7).
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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(COOKIE_NAME)?.value);

  if (pathname === '/login') {
    return signedIn ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL('/login', request.url);

    // Remember where they were headed so the login can return them there.
    if (pathname !== '/') login.searchParams.set('next', pathname + search);

    return NextResponse.redirect(login);
  }

  return NextResponse.next();
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
