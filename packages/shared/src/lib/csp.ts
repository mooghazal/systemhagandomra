/**
 * The Content-Security-Policy, built per request.
 *
 * It lives here rather than in next.config because of `script-src`. A policy
 * that lets inline scripts run — which is what `'unsafe-inline'` means — stops
 * an injected one from being blocked, so the directive is only worth having
 * with a nonce, and a nonce has to be new on every request. A static config
 * file cannot produce one.
 *
 * The other headers are static and stay in next.config, where they belong.
 */

/**
 * How the edge hands the nonce to the server render.
 *
 * A request header rather than anything shared in memory: the two run in
 * different places, and this is the only channel between them that Next
 * guarantees.
 */
export const NONCE_HEADER = 'x-csp-nonce';

/**
 * A fresh nonce.
 *
 * `crypto.getRandomValues` rather than Math.random: the whole value of a
 * nonce is that an attacker injecting a script cannot guess the one the page
 * is using, and Math.random is predictable from previous outputs.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);

  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string, isProduction: boolean): string {
  const directives = [
    "default-src 'self'",

    /*
     * Development runs scripts through eval — that is how fast refresh
     * replaces a module without reloading the page — so a policy strict
     * enough to be worth having would break the dev server. The strict
     * version applies to builds, which is where it matters.
     *
     * 'strict-dynamic' lets a script this policy trusts load others, which is
     * what Next's own chunk loader does; without it every chunk would need
     * its own nonce. 'unsafe-inline' sits after the nonce on purpose: a
     * browser that understands nonces ignores it, and one too old to
     * understand them is no worse off than before this header existed.
     */
    isProduction
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

    // Next injects the stylesheet inline during development, and styled
    // attributes are used throughout for the accent colours.
    "style-src 'self' 'unsafe-inline'",

    // Fonts come from Google's CDN through next/font.
    "font-src 'self' data: https://fonts.gstatic.com",

    // Uploaded images are served from the Laravel origin, which is a
    // different port in development and may be a different host in
    // production.
    "img-src 'self' data: blob: http://localhost:8000 http://127.0.0.1:8000",

    "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000",

    // Nothing here is framed, frames anything, or submits off-site.
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}
