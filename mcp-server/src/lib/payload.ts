import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { CHARACTER_LIMIT } from '../config.js';
import type { Paginated } from '../types.js';

/**
 * Builds the JSON body for a write.
 *
 * This carries the rule the whole system turns on, and it is worth being
 * explicit about because getting it wrong is silent:
 *
 *   - a key the agent did not supply is **omitted**, and the backend leaves
 *     that field exactly as it was;
 *   - a key supplied as **null** is sent as null, and the backend clears it;
 *   - `0`, `false` and `[]` are values and are sent as themselves.
 *
 * So "set the price to zero", "remove the price" and "don't touch the price"
 * are three different requests, and the agent can express all three. If it
 * does not know a value, it must leave the key out and ask the person — a
 * guessed default would be indistinguishable from a deliberate one.
 */
export function buildPayload(input: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    payload[key] = value;
  }

  return payload;
}

/**
 * The SDK's own result type, rather than a local approximation of it — a
 * hand-written interface drifts the moment the SDK adds a field.
 */
export type ToolResult = CallToolResult;

export function ok(data: unknown, summary?: string): ToolResult {
  const body = JSON.stringify(data, null, 2);
  const text = summary ? `${summary}\n\n${body}` : body;

  return {
    content: [{ type: 'text', text }],
    structuredContent: data as Record<string, unknown>,
  };
}

export function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Formats a page of results, trimming it if it would swamp the agent's
 * context — and saying so, with the parameter that would narrow it.
 */
export function okList<T>(page: Paginated<T>, noun: string): ToolResult {
  const output: Record<string, unknown> = {
    total: page.meta.total,
    page: page.meta.current_page,
    last_page: page.meta.last_page,
    count: page.items.length,
    [noun]: page.items,
  };

  if (page.meta.current_page < page.meta.last_page) {
    output.next_page = page.meta.current_page + 1;
  }

  let text = JSON.stringify(output, null, 2);

  if (text.length > CHARACTER_LIMIT) {
    const kept = Math.max(1, Math.floor(page.items.length / 2));

    output[noun] = page.items.slice(0, kept);
    output.truncated = true;
    output.truncation_note =
      `Showing ${kept} of ${page.items.length} on this page because the full response was too large. ` +
      'Use `search`, a filter, or a smaller `per_page` to narrow it.';

    text = JSON.stringify(output, null, 2);
  }

  const summary =
    page.meta.total === 0
      ? `No ${noun} matched.`
      : `${page.meta.total} ${noun} in total; page ${page.meta.current_page} of ${page.meta.last_page}.`;

  return {
    content: [{ type: 'text', text: `${summary}\n\n${text}` }],
    structuredContent: output,
  };
}
