import type { Config } from '../config.js';
import type { ApiEnvelope, Paginated, PaginationMeta } from '../types.js';

/**
 * The only way this server reaches anything.
 *
 * Every tool goes through here, and here goes to one place: the Laravel API,
 * authenticated as one account. That is the design — not a convention this
 * code follows, but the limit of what the process can do. There is no database
 * client to fall back on and no second credential, so "the agent must not
 * bypass authorisation" is not a rule to enforce; there is no path to bypass.
 *
 * Laravel then applies, on every single call: authentication, the account's
 * role and permissions, tenant isolation, validation, business rules, and the
 * audit trail. The token carries the `mcp` ability, which is how the trail
 * records that a change came from the agent rather than from a person.
 */

/** A failure the agent can reason about, rather than a raw HTTP error. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class HagamraClient {
  constructor(private readonly config: Config) {}

  async get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
    const envelope = await this.send<T>('GET', path, undefined, query);

    return (envelope as { data: T }).data;
  }

  async list<T>(path: string, query?: Record<string, unknown>): Promise<Paginated<T>> {
    const envelope = await this.send<T[]>('GET', path, undefined, query);
    const items = (envelope as { data: T[] }).data;

    return {
      items,
      // Endpoints that return a plain array still need a shape callers can
      // report consistently.
      meta: envelope.meta ?? {
        current_page: 1,
        per_page: items.length,
        total: items.length,
        last_page: 1,
      },
    };
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const envelope = await this.send<T>('POST', path, body);

    return (envelope as { data: T }).data;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const envelope = await this.send<T>('PUT', path, body);

    return (envelope as { data: T }).data;
  }

  async delete(path: string): Promise<void> {
    await this.send<null>('DELETE', path);
  }

  private async send<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
  ): Promise<ApiEnvelope<T> & { meta?: PaginationMeta }> {
    const url = new URL(`${this.config.apiUrl}/${path.replace(/^\/+/, '')}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      // An absent filter and an empty one mean the same thing to the backend.
      if (value === undefined || value === null || value === '') continue;

      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/json',
          // English, because whoever reads an agent's output is a developer or
          // an operator — the Arabic wording belongs to the dashboards.
          'Accept-Language': 'en',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(0, `The backend did not respond within ${this.config.timeoutMs}ms.`);
      }

      throw new ApiError(
        0,
        `Could not reach the backend at ${this.config.apiUrl}. Is it running?`,
      );
    } finally {
      clearTimeout(timer);
    }

    const envelope = (await response.json().catch(() => null)) as
      | (ApiEnvelope<T> & { meta?: PaginationMeta })
      | null;

    if (!response.ok || !envelope?.success) {
      const failure = envelope && !envelope.success ? envelope : null;

      throw new ApiError(
        response.status,
        failure?.message ?? `The request failed with status ${response.status}.`,
        failure?.errors ?? {},
      );
    }

    return envelope;
  }
}

/**
 * Turns a failure into something the agent can act on, rather than retry
 * blindly or report as an unexplained error.
 *
 * The distinction that matters: a 422 means the agent sent something wrong and
 * should fix it or ask the person for the missing detail. A 403 means the
 * account is not allowed and no amount of rephrasing will help — the agent
 * should say so and stop.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const fields = Object.entries(error.fieldErrors)
    .map(([field, messages]) => `  - ${field}: ${messages.join(' ')}`)
    .join('\n');

  switch (error.status) {
    case 401:
      return (
        'The access token was rejected. It may have been revoked, or the account disabled.\n' +
        'Issue a new one from the backend: php artisan mcp:token <email>'
      );

    case 403:
      return (
        `Not permitted: ${error.message}\n` +
        'This account does not hold the permission this action needs. Do not retry — ' +
        'tell the person which permission is missing and who can grant it (their company owner).'
      );

    case 404:
      return (
        'Not found. Either no record has that id, or it belongs to another company — ' +
        'the two are indistinguishable on purpose. Use the matching list tool to find ' +
        'the right id.'
      );

    case 422:
      return (
        `The data was rejected:\n${fields || `  ${error.message}`}\n\n` +
        'Fix the fields named above. If a required value is simply not known, ask the ' +
        'person for it — do not invent one.'
      );

    case 429:
      return 'Rate limited. Wait about a minute before trying again.';

    default:
      return error.status >= 500
        ? 'The backend failed to process the request. Nothing was changed. Try again shortly.'
        : `Request failed: ${error.message}`;
  }
}
