import { describe, expect, it } from 'vitest';

import { safeInternalPath } from './safe-redirect';

const ORIGIN = 'https://panel.example';

/**
 * The login page sends people here after they type their password, so every
 * case below is "can an attacker choose where that lands".
 */
describe('safeInternalPath', () => {
  it('keeps an ordinary path, with its query and fragment', () => {
    expect(safeInternalPath('/packages?page=2#top', ORIGIN)).toBe('/packages?page=2#top');
  });

  it('falls back to the root when there is nothing to go on', () => {
    expect(safeInternalPath(null, ORIGIN)).toBe('/');
    expect(safeInternalPath('', ORIGIN)).toBe('/');
  });

  /*
   * Every one of these resolves to another origin. The check this replaced —
   * startsWith('/') and not startsWith('//') — let the backslash forms
   * through, which is a full open redirect off the back of a real sign-in.
   */
  it.each([
    ['protocol-relative', '//evil.example'],
    ['backslash', '/\\evil.example'],
    ['double backslash', '/\\\\evil.example'],
    ['backslash then slash', '/\\/evil.example'],
    ['absolute http', 'https://evil.example/x'],
    ['scheme with one slash', 'https:/evil.example'],
    ['tab inside', '/\t/evil.example'],
    ['newline inside', '/\n/evil.example'],
    ['carriage return inside', '/\r/evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['credentials trick', '//user:pass@evil.example'],
  ])('refuses %s', (_label, value) => {
    const result = safeInternalPath(value, ORIGIN);

    // Whatever it returns must be a path on this origin and nowhere else.
    expect(new URL(result, ORIGIN).origin).toBe(ORIGIN);
  });

  it('does not let a path walk up into another origin', () => {
    expect(new URL(safeInternalPath('/..//evil.example', ORIGIN), ORIGIN).origin).toBe(ORIGIN);
  });

  it('never returns something that parses to a different origin', () => {
    // A sweep rather than a list: anything that survives must stay here.
    const candidates = [
      '/ok', '//evil.example', '/\\evil.example', '\\\\evil.example', '/%2f%2fevil.example',
      '///evil.example', 'http:evil.example', '/\u0000/evil.example', '  //evil.example',
    ];

    for (const candidate of candidates) {
      const result = safeInternalPath(candidate, ORIGIN);

      expect(result.startsWith('/'), `${candidate} -> ${result}`).toBe(true);
      expect(new URL(result, ORIGIN).origin, `${candidate} -> ${result}`).toBe(ORIGIN);
    }
  });
});
