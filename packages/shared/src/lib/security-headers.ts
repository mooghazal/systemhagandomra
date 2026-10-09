/**
 * The response headers both panels send on every request.
 *
 * Laravel already sets these on its own responses, but the browser never loads
 * a page from Laravel — it loads the panel from Next, and until this existed
 * Next sent none of them. The admin panel could be framed by any site: an
 * attacker who got a signed-in admin to open their page could render the real
 * panel invisibly on top of a decoy and have the admin's own clicks land on
 * whatever control they chose.
 *
 * The Content-Security-Policy is not here. It needs a nonce, which has to be
 * new on every request, so it is built at the edge in each app's proxy.ts —
 * see lib/csp. These are the headers whose value never changes, which is why
 * a static list is the right place for them.
 */
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  // Two spellings of the same rule. frame-ancestors is the one that counts;
  // X-Frame-Options is kept for anything that does not implement it.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stops a response being treated as a type it did not declare — the usual
  // route from "an image was uploaded" to "a script ran".
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Paths in this panel carry record ids. None of that belongs in a Referer
  // header sent to somewhere else.
  { key: 'Referrer-Policy', value: 'no-referrer' },

  // No page here uses any of these, and a compromised dependency should not be
  // able to start.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },

  /*
   * Inert over plain HTTP, which is why it is safe to set now: a browser
   * ignores it unless the response arrived over TLS. Once the panel is served
   * over HTTPS it takes effect without anyone having to remember this file.
   */
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];
