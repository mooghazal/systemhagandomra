import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api } from './api';

/**
 * Error handling per status code (spec §51).
 *
 * The point of these is that a person should never meet a raw status code or
 * an English framework message, and that a 500's internals never reach the
 * screen.
 */

function respond(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

/** Resolves with whatever the request threw, failing the test if it succeeded. */
function captureError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the request to fail, but it succeeded.');
    },
    (caught: unknown) => caught,
  );
}

/** Narrows to ApiError, so the assertions below are type-checked rather than cast away. */
function asApiError(error: unknown): ApiError {
  if (!(error instanceof ApiError)) {
    throw new Error(`Expected an ApiError, received: ${String(error)}`);
  }

  return error;
}

describe('api error handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the data on success', async () => {
    vi.mocked(fetch).mockReturnValue(respond(200, { success: true, data: { id: 7 } }));

    await expect(api.get('packages/7')).resolves.toEqual({ id: 7 });
  });

  it('keeps per-field messages on a 422 so they can sit beside inputs', async () => {
    vi.mocked(fetch).mockReturnValue(
      respond(422, {
        success: false,
        message: 'The given data was invalid.',
        errors: { name: ['حقل الاسم مطلوب.'] },
      }),
    );

    const error = asApiError(await captureError(api.post('packages', {})));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.isValidation).toBe(true);
    expect(error.fieldError('name')).toBe('حقل الاسم مطلوب.');
  });

  it('explains a 403 in Arabic', async () => {
    vi.mocked(fetch).mockReturnValue(respond(403, { success: false, message: 'Forbidden.' }));

    const error = asApiError(await captureError(api.get('companies')));

    expect(error.isForbidden).toBe(true);
    expect(error.message).toMatch(/صلاحية/);
  });

  it('explains a 404 in Arabic', async () => {
    vi.mocked(fetch).mockReturnValue(respond(404, { success: false, message: 'Not found.' }));

    const error = asApiError(await captureError(api.get('packages/999')));

    expect(error.isNotFound).toBe(true);
    expect(error.message).toMatch(/غير موجود/);
  });

  it('explains a 429 in Arabic', async () => {
    vi.mocked(fetch).mockReturnValue(respond(429, { success: false, message: 'Too many.' }));

    const error = asApiError(await captureError(api.get('packages')));

    expect(error.status).toBe(429);
    expect(error.message).toMatch(/طلبات كثيرة/);
  });

  it('never shows what a 500 said', async () => {
    vi.mocked(fetch).mockReturnValue(
      respond(500, {
        success: false,
        message: "SQLSTATE[42S02]: Base table 'secrets' not found at /var/www/app/Secret.php:42",
      }),
    );

    const error = asApiError(await captureError(api.get('packages')));

    expect(error.message).not.toContain('SQLSTATE');
    expect(error.message).not.toContain('/var/www');
    expect(error.message).toMatch(/خطأ غير متوقع/);
  });

  it('reports a dead connection rather than throwing a fetch error', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const error = asApiError(await captureError(api.get('packages')));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/تعذّر الاتصال/);
  });

  it('lets an abort through untouched so a cancelled request is not a failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('aborted', 'AbortError'));

    const error = await captureError(api.get('packages'));

    expect(error).toBeInstanceOf(DOMException);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it('drops empty filters from the query string', async () => {
    vi.mocked(fetch).mockReturnValue(respond(200, { success: true, data: [] }));

    await api.list('packages', { page: 1, search: '', trip_type: undefined, is_active: null });

    const url = vi.mocked(fetch).mock.calls[0][0] as string;

    expect(url).toContain('page=1');
    expect(url).not.toContain('search=');
    expect(url).not.toContain('trip_type');
    expect(url).not.toContain('is_active');
  });

  it('supplies paging for an endpoint that returns a plain array', async () => {
    vi.mocked(fetch).mockReturnValue(
      respond(200, { success: true, data: [{ id: 1 }, { id: 2 }] }),
    );

    const result = await api.list<{ id: number }>('companies/1/owners');

    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.last_page).toBe(1);
  });

  it('spoofs the method on an upload, because PHP cannot parse multipart on PUT', async () => {
    vi.mocked(fetch).mockReturnValue(respond(200, { success: true, data: {} }));

    const form = new FormData();
    form.append('name', 'باقة');

    await api.upload('packages/7', form, 'PUT');

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;

    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('_method')).toBe('PUT');
    // Setting Content-Type here would clobber the multipart boundary.
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});
