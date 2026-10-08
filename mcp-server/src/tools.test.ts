import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ApiError, describeError } from './lib/client.js';
import { buildPayload, okList } from './lib/payload.js';

/**
 * The parts of the server that can be checked without a backend.
 *
 * The end-to-end check lives in probe.ts, which drives the real protocol
 * against a running Laravel. These cover the logic that decides what gets
 * sent and what the agent is told when something is refused — the places a
 * mistake is silent rather than loud.
 */

describe('buildPayload', () => {
  it('omits what the agent did not supply', () => {
    // An absent key means "leave that field alone". Sending it as null would
    // mean "clear it", which is a different instruction entirely.
    expect(buildPayload({ name: 'Ramadan Umrah', price: undefined })).toEqual({
      name: 'Ramadan Umrah',
    });
  });

  it('keeps an explicit null, because that is how a field is cleared', () => {
    expect(buildPayload({ price: null })).toEqual({ price: null });
  });

  it('keeps zero, false and the empty list', () => {
    // "Free" is a price. "Not on offer" is a state. "No features" is an answer.
    expect(buildPayload({ price: 0, is_active: false, features: [] })).toEqual({
      price: 0,
      is_active: false,
      features: [],
    });
  });

  it('separates the three meanings in one payload', () => {
    const payload = buildPayload({
      name: 'Changed',
      price: null,
      days: undefined,
      features: [],
    });

    expect(payload).toEqual({ name: 'Changed', price: null, features: [] });
    expect('days' in payload).toBe(false);
  });
});

describe('describeError', () => {
  it('tells the agent to stop, not retry, on a refusal', () => {
    const message = describeError(new ApiError(403, 'This action is unauthorized.'));

    expect(message).toContain('Not permitted');
    expect(message).toMatch(/[Dd]o not retry/);
  });

  it('explains that a missing id and another company look the same', () => {
    const message = describeError(new ApiError(404, 'Resource not found.'));

    expect(message).toContain('another company');
    expect(message).toContain('indistinguishable');
  });

  it('names the fields that were rejected and says not to invent values', () => {
    const message = describeError(
      new ApiError(422, 'The given data was invalid.', {
        name: ['The name field is required.'],
        end_date: ['The end date must fall on or after the start date.'],
      }),
    );

    expect(message).toContain('name:');
    expect(message).toContain('end_date:');
    expect(message).toMatch(/do not invent/i);
  });

  it('tells the operator how to reissue a dead token', () => {
    expect(describeError(new ApiError(401, 'Unauthenticated.'))).toContain('php artisan mcp:token');
  });

  it('says nothing was changed on a server fault', () => {
    // Important for an agent deciding whether to retry a write.
    expect(describeError(new ApiError(500, 'Server error.'))).toContain('Nothing was changed');
  });

  it('asks for a pause on a rate limit', () => {
    expect(describeError(new ApiError(429, 'Too many requests.'))).toMatch(/[Ww]ait/);
  });

  it('handles something that is not an ApiError at all', () => {
    expect(describeError(new TypeError('boom'))).toContain('Unexpected error');
  });
});

describe('okList', () => {
  const page = <T,>(items: T[], total: number, current = 1, last = 1) => ({
    items,
    meta: { current_page: current, per_page: 25, total, last_page: last },
  });

  it('summarises a page and offers the next one', () => {
    const result = okList(page([{ id: 1 }], 60, 1, 3), 'packages');

    expect(result.structuredContent).toMatchObject({ total: 60, page: 1, next_page: 2 });
  });

  it('offers no next page on the last one', () => {
    const result = okList(page([{ id: 1 }], 1, 1, 1), 'packages');

    expect(result.structuredContent).not.toHaveProperty('next_page');
  });

  it('says plainly when nothing matched', () => {
    const result = okList(page([], 0), 'hotels');

    expect(result.content[0]?.text).toContain('No hotels matched');
  });

  it('trims a response that would swamp the agent, and says how to narrow it', () => {
    const fat = Array.from({ length: 200 }, (_, index) => ({
      id: index,
      description: 'x'.repeat(400),
    }));

    const result = okList(page(fat, 200), 'packages');
    const output = result.structuredContent as Record<string, unknown>;

    expect(output.truncated).toBe(true);
    expect(String(output.truncation_note)).toContain('per_page');
    expect((output.packages as unknown[]).length).toBeLessThan(fat.length);
  });
});

describe('tool schemas', () => {
  it('a create schema requires only a name', () => {
    /*
     * Mirrors the shape the package tool registers. If this ever grows a
     * second required field, an agent told only "add a package called X"
     * would have to invent the rest — which is the behaviour the whole
     * design is trying to prevent.
     */
    const schema = z.object({
      name: z.string().min(1),
      price: z.number().optional(),
      days: z.number().int().optional(),
      features: z.array(z.string()).optional(),
    });

    expect(schema.safeParse({ name: 'Ramadan Umrah' }).success).toBe(true);
    expect(schema.safeParse({ price: 35000 }).success).toBe(false);
  });

  it('an update schema accepts null so a field can be cleared', () => {
    const schema = z.object({
      price: z.number().nullable().optional(),
    });

    expect(schema.safeParse({}).success).toBe(true);            // untouched
    expect(schema.safeParse({ price: null }).success).toBe(true); // cleared
    expect(schema.safeParse({ price: 0 }).success).toBe(true);    // free
  });
});
