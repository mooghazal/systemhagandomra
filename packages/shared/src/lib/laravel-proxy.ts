import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { apiUrl, clearToken, getToken } from './session';

/**
 * Transport only, shared by both panels.
 *
 * The browser cannot read the httpOnly cookie holding the access token, so it
 * cannot set an Authorization header either. This forwards same-origin
 * requests to Laravel with that header attached, and returns what Laravel
 * said.
 *
 * It makes no decisions. It does not know what a package is, never inspects a
 * body, never calls a database, and adds no rules of its own — Laravel remains
 * the only authority (spec §60).
 *
 * It lived as an identical copy in each app until a path-traversal hole turned
 * up in it. One copy of a file like this, fixed once, is the point.
 */

/**
 * A single path segment the proxy is willing to forward.
 *
 * Next decodes `%2f` inside a catch-all *after* splitting on `/`, so one URL
 * segment can arrive already carrying separators: `..%2f..%2fup` reaches this
 * function as the single segment `../../up`. Joined onto the base and handed
 * to `new URL()`, the dot segments resolve and the request leaves `/api`
 * altogether — reaching any route on the Laravel host, with no valid token,
 * because the gate below only checks that a cookie exists.
 *
 * That was not theoretical: `/api/laravel/..%2f..%2f` returned Laravel's
 * welcome page and `..%2f..%2fup` returned the health endpoint, both to a
 * request carrying the cookie `hagamra_admin=totally-fake`.
 *
 * Every path this API actually serves is plain segments, so anything else is
 * refused outright rather than normalised. A rewrite that tries to be clever
 * about `..` is how this class of bug comes back.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function isSafePath(path: string[]): boolean {
  return (
    path.length > 0
    && path.every(
      (segment) =>
        SAFE_SEGMENT.test(segment)
        // `.` and `..` match the pattern above and have to go explicitly.
        && segment !== '.'
        && segment !== '..',
    )
  );
}

/**
 * Headers copied from the browser's request to Laravel.
 *
 * An allow-list, because the alternative is forwarding whatever a client
 * invents. The previous deny-list relayed `X-Forwarded-For`, `X-Forwarded-Host`
 * and `X-HTTP-Method-Override` straight through: harmless while Laravel trusts
 * no proxies, and a rate-limit bypass and audit-log forgery the day it does —
 * which is exactly what happens when this proxy becomes the single ingress in
 * front of it.
 *
 * `content-type` is not optional: a multipart upload's boundary lives in it.
 */
const FORWARDED_REQUEST_HEADERS = ['content-type', 'user-agent'];

/**
 * Headers copied back from Laravel to the browser.
 *
 * Also an allow-list. The deny-list version relayed `Set-Cookie` — reached
 * through the traversal above, Laravel's `web` group planted its own session
 * cookie on the panel's origin — and relayed `Content-Type: text/html`, which
 * turns any HTML the proxy can reach into script running on this origin, where
 * it can drive the panel as the signed-in user.
 */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  // Carries the download's filename, which Laravel builds with the resource's
  // Arabic name and today's date. Always an attachment either way — the
  // fallback below sets that when upstream says nothing.
  'content-disposition',
  // So a client can tell a throttle from a refusal.
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
];

/**
 * Laravel endpoints whose response body contains an access token.
 *
 * The whole reason the token lives in an httpOnly cookie is that a script
 * cannot read it. Relaying these through the proxy would undo that: the
 * browser would receive a token as ordinary JSON, which is exactly the thing
 * an XSS is looking for. Both have a dedicated route of their own that keeps
 * the token server-side and returns only whether it worked.
 */
const TOKEN_BEARING_PATHS = new Set(['auth/login', 'auth/password']);

function notFound(): NextResponse {
  // Indistinguishable from a path Laravel does not serve. A refusal that
  // announced "that looked like traversal" would just be a hint.
  return NextResponse.json({ success: false, message: 'Not found.' }, { status: 404 });
}

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (!isSafePath(path)) return notFound();

  if (TOKEN_BEARING_PATHS.has(path.join('/').toLowerCase())) return notFound();

  const token = await getToken();

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Unauthenticated.' },
      { status: 401 },
    );
  }

  const base = apiUrl();
  const target = new URL(`${base}/${path.join('/')}`);

  // Belt and braces. The segment check above should make this unreachable;
  // if some future encoding quirk gets past it, the request still stops here
  // rather than leaving the API prefix.
  if (!target.href.startsWith(`${base}/`)) return notFound();

  target.search = request.nextUrl.search;

  const headers = new Headers();

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);

    if (value !== null) headers.set(name, value);
  }

  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  // The panel is Arabic, so validation messages should come back in Arabic.
  headers.set('Accept-Language', 'ar');
  // Tells the audit trail this came from a person using the panel. Laravel
  // ignores it for anything that matters: a token's own abilities decide
  // whether a request counts as agent traffic, not this header.
  headers.set('X-Client-Source', 'dashboard');

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let upstream: Response;

  try {
    upstream = await fetch(target, {
      method,
      headers,
      // Streams the body straight through, so a multipart image upload is
      // passed along without being buffered or re-encoded here.
      body: hasBody ? request.body : undefined,
      // @ts-expect-error -- duplex is required by undici for a streamed body
      // and is not yet in the TypeScript DOM lib.
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    // The backend being unreachable is this app's problem to describe, not
    // something to surface as a cryptic fetch failure.
    return NextResponse.json(
      { success: false, message: 'Could not reach the server. Please try again.' },
      { status: 502 },
    );
  }

  if (upstream.status === 401) {
    await clearToken();
  }

  const responseHeaders = new Headers();

  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);

    if (value !== null) responseHeaders.set(name, value);
  }

  /*
   * Nothing from this route is meant to be rendered as a page — the panel
   * reads every one of these responses with fetch(), which ignores this
   * header. A browser pointed straight at a proxy URL downloads the body
   * instead of running it, so a response that somehow carries markup cannot
   * execute on the panel's own origin.
   */
  if (!responseHeaders.has('Content-Disposition')) {
    responseHeaders.set('Content-Disposition', 'attachment');
  }
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  // A 3xx with an upstream Location would make this route an open redirector
  // on the panel's origin. Nothing the panel calls redirects.
  const status = upstream.status >= 300 && upstream.status < 400 ? 502 : upstream.status;

  return new NextResponse(upstream.body, { status, headers: responseHeaders });
}

type Context = { params: Promise<{ path: string[] }> };

/*
 * The five verbs the API uses, exported under the names Next looks for. Any
 * other method gets Next's own 405, because no handler exists for it.
 */

export async function GET(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}

export async function PUT(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}

export async function PATCH(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: Context) {
  return forward(request, (await context.params).path);
}
