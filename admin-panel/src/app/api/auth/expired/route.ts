import { NextRequest, NextResponse } from 'next/server';

import { clearToken } from '@hagamra/shared/lib/session';

/**
 * Where a page lands when Laravel says its token is no longer good.
 *
 * It exists because of where cookies may be written. A Server Component
 * cannot delete one — the attempt throws — so a layout that discovered a dead
 * session could only redirect to /login while leaving the stale cookie in
 * place. The middleware then read that cookie as "signed in" and sent /login
 * back to /, which discovered the dead session again. The two bounced off each
 * other until the browser gave up, and the person was locked out of the panel
 * with no way back in but clearing their cookies by hand.
 *
 * A route handler may write cookies, and /api is outside the middleware's
 * matcher, so this clears the cookie and then sends them on to a login page
 * that will actually render.
 */
export async function GET(request: NextRequest) {
  await clearToken();

  const login = new URL('/login', request.url);

  return NextResponse.redirect(login, {
    // 303: whatever the method was, the browser follows with a GET.
    status: 303,
    // This decision is about one request's cookie and must never be reused.
    headers: { 'Cache-Control': 'no-store' },
  });
}
