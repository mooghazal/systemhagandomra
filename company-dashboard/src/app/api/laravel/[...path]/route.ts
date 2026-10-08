import { NextRequest, NextResponse } from 'next/server';

import { apiUrl, clearToken, getToken } from '@hagamra/shared/lib/session';

/**
 * Transport only.
 *
 * The browser cannot read the httpOnly cookie holding the access token, so it
 * cannot set an Authorization header either. This forwards same-origin
 * requests to Laravel with that header attached, and returns whatever Laravel
 * said, untouched.
 *
 * It makes no decisions. It does not know what a package is, never inspects a
 * body, never calls a database, and adds no rules of its own — Laravel remains
 * the only authority (spec §60). If this file disappeared, the system would
 * lose a cookie-to-header translation and nothing else.
 *
 * The one behaviour beyond forwarding: a 401 from Laravel clears the dead
 * cookie, so the panel stops presenting a revoked token on every later request.
 */


/** Hop-by-hop and length headers must not be copied onto a re-issued request. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
  'cookie',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  // Laravel's CORS answer is meaningless here: this hop is same-origin.
  'access-control-allow-origin',
  'access-control-allow-credentials',
]);

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  const token = await getToken();

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Unauthenticated.' },
      { status: 401 },
    );
  }

  const target = new URL(apiUrl(path.join('/')));
  target.search = request.nextUrl.search;

  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

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

  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Context = { params: Promise<{ path: string[] }> };

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
