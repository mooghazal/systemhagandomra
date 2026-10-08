import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../lib/api';
import type { Paginated } from '../types';

import { useResource } from './useResource';

/**
 * List state: paging, debounced search, filters, and dropping the answer to a
 * question nobody is asking any more.
 *
 * The last one is the subtle one. Typing fires a request per pause, and
 * responses do not necessarily come back in order — so a slow early response
 * can land after a fast later one and overwrite the right answer with a stale
 * one. The test for that is the reason this file exists.
 */

interface Row {
  id: number;
}

function page(items: Row[], meta: Partial<Paginated<Row>['meta']> = {}): Paginated<Row> {
  return {
    items,
    meta: { current_page: 1, per_page: 15, total: items.length, last_page: 1, ...meta },
  };
}

describe('useResource', () => {
  it('loads on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([{ id: 1 }, { id: 2 }]));

    const { result } = renderHook(() => useResource<Row>(fetcher));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('waits for a pause before searching', async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn().mockResolvedValue(page([]));
    const { result } = renderHook(() => useResource<Row>(fetcher));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fetcher.mockClear();

    // Someone typing "رمضان" should not cause six requests.
    act(() => {
      result.current.setSearch('ر');
    });
    act(() => {
      result.current.setSearch('رم');
    });
    act(() => {
      result.current.setSearch('رمضان');
    });

    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toMatchObject({ search: 'رمضان' });

    vi.useRealTimers();
  });

  it('returns to the first page when the search changes', async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn().mockResolvedValue(page([], { last_page: 5 }));
    const { result } = renderHook(() => useResource<Row>(fetcher));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    act(() => {
      result.current.setPage(4);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.page).toBe(4);

    // Page 4 of the old result set has nothing to do with the new one.
    act(() => {
      result.current.setSearch('جديد');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(result.current.page).toBe(1);

    vi.useRealTimers();
  });

  it('drops a filter set to an empty value instead of sending it', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]));
    const { result } = renderHook(() => useResource<Row>(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilter('trip_type', 'عمرة');
    });
    await waitFor(() => expect(result.current.filters).toEqual({ trip_type: 'عمرة' }));

    // "All types" is the absence of a filter, not a filter whose value is "".
    act(() => {
      result.current.setFilter('trip_type', '');
    });
    await waitFor(() => expect(result.current.filters).toEqual({}));
  });

  it('surfaces a failure and clears the stale rows', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: 1 }]))
      .mockRejectedValueOnce(new ApiError(403, 'ليست لديك صلاحية.'));

    const { result } = renderHook(() => useResource<Row>(fetcher));

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    expect(result.current.error?.status).toBe(403);
    expect(result.current.items).toEqual([]);
  });

  it('wraps an unexpected throw so the screen still has something to say', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('boom'));

    const { result } = renderHook(() => useResource<Row>(fetcher));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    expect(result.current.error?.message).toMatch(/تعذّر تحميل البيانات/);
  });

  it('treats an aborted request as a cancellation, not a failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));

    const { result } = renderHook(() => useResource<Row>(fetcher));

    // Give the effect time to settle; nothing should be reported.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.error).toBeNull();
  });

  it('does not let a slow earlier response overwrite a newer one', async () => {
    /*
     * Two requests in flight, the first slower than the second. Without the
     * guard the stale answer lands last and the table shows results for a
     * search the person has already moved on from.
     */
    let resolveSlow: ((value: Paginated<Row>) => void) | undefined;

    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Paginated<Row>>((resolve) => {
        resolveSlow = resolve;
      }))
      .mockResolvedValueOnce(page([{ id: 99 }]));

    const { result } = renderHook(() => useResource<Row>(fetcher));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.items).toEqual([{ id: 99 }]));

    // The first request finally answers — and must be ignored.
    act(() => {
      resolveSlow?.(page([{ id: 1 }]));
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.items).toEqual([{ id: 99 }]);
  });

  it('reload refetches without changing the query', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]));
    const { result } = renderHook(() => useResource<Row>(fetcher));

    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    expect(fetcher.mock.calls[1]?.[0]).toMatchObject({ page: 1, search: '' });
  });
});
