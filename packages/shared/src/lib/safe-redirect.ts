/**
 * Where the login page is allowed to send someone afterwards.
 *
 * The `next` parameter decides where a successful sign-in lands, so an
 * attacker who controls it controls where a person arrives immediately after
 * typing their password — on a page that looked, until that moment, entirely
 * legitimate. A clone saying "session expired, sign in again" collects the
 * credential they have just proved they will type.
 *
 * Checking the string by hand is what failed before: `startsWith('/')` and
 * `!startsWith('//')` looks airtight and is not. `useSearchParams().get()`
 * returns the *decoded* value, and the URL parser treats a backslash as a
 * separator in an http(s) URL, so `/\evil.com` passed the check and resolved
 * to `https://evil.com/`.
 *
 * So the string is not inspected at all. It is resolved against this origin by
 * the same parser the browser will use, and kept only if it stayed here.
 */
export function safeInternalPath(next: string | null, origin: string): string {
  if (next === null || next === '') return '/';

  try {
    const url = new URL(next, origin);

    if (url.origin !== origin) return '/';

    /*
     * Collapsing the leading slashes is not cosmetic.
     *
     * `/..//evil.example` resolves against this origin — the parser removes
     * the dot segment and leaves the *pathname* `//evil.example`, so the
     * origin check above passes. Handing that back to the router makes it
     * protocol-relative all over again and the browser leaves for
     * evil.example. The check has to survive its own output being re-parsed.
     */
    const path = url.pathname.replace(/^\/+/, '/');

    // Rebuilt from the parsed parts rather than returned as given, so what is
    // navigated to is what was checked.
    return `${path}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
