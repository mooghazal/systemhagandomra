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
 * `Content-Security-Policy` here covers framing, form targets, plugins and the
 * base tag — the directives that can be set without threading a nonce through
 * every inline script Next emits. A `script-src` policy would be worth having
 * too, but it has to come with nonces or it either breaks the app or is
 * trivially bypassed, so it is a separate job rather than a line here.
 */
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  // Two spellings of the same rule. frame-ancestors is the one that counts;
  // X-Frame-Options is kept for anything that does not implement it.
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: [
      "frame-ancestors 'none'",
      // Nothing on these pages submits anywhere but back to itself.
      "form-action 'self'",
      // A <base> tag injected into the document could otherwise re-point every
      // relative URL on the page, including the ones the panel posts to.
      "base-uri 'none'",
      "object-src 'none'",
      // Uploaded images are served from the Laravel origin.
      'upgrade-insecure-requests',
    ].join('; '),
  },

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
