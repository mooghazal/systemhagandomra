/**
 * Configuration, read once at startup.
 *
 * The token is the agent's whole identity. It belongs to one account, carries
 * that account's role, company and permissions, and is the only credential
 * this process has — there is no database connection, no admin key, no way to
 * reach anything the Laravel API would not hand to that same account signing
 * in through a browser.
 */

export interface Config {
  apiUrl: string;
  token: string;
  timeoutMs: number;
}

export function loadConfig(): Config {
  const token = process.env.HAGAMRA_API_TOKEN?.trim();

  if (!token) {
    throw new Error(
      'HAGAMRA_API_TOKEN is not set.\n' +
        'Issue one from the backend:  php artisan mcp:token <email>',
    );
  }

  const apiUrl = (process.env.HAGAMRA_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '');

  const timeout = Number(process.env.HAGAMRA_TIMEOUT_MS ?? 30000);

  return {
    apiUrl,
    token,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 30000,
  };
}

/** Caps a tool response so a large list cannot swamp the agent's context. */
export const CHARACTER_LIMIT = 25_000;
