import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelection } from './useSelection';

const rows = (...ids: number[]) => ids.map((id) => ({ id }));

/**
 * Row selection for bulk actions.
 *
 * The case worth most of these tests is the one that would do real damage: an
 * id ticked before a filter changed must not still be acted on afterwards. A
 * bulk delete operating on a stale list deletes the wrong records and reports
 * success.
 */
describe('useSelection', () => {
  it('starts with nothing selected', () => {
    const { result } = renderHook(() => useSelection(rows(1, 2, 3)));

    expect(result.current.count).toBe(0);
    expect(result.current.ids).toEqual([]);
  });

  it('toggles a row on and off', () => {
    const { result } = renderHook(() => useSelection(rows(1, 2, 3)));

    act(() => result.current.toggle(2));
    expect(result.current.ids).toEqual([2]);

    act(() => result.current.toggle(2));
    expect(result.current.ids).toEqual([]);
  });

  it('selects every row on the page at once', () => {
    const { result } = renderHook(() => useSelection(rows(1, 2, 3)));

    act(() => result.current.toggleAll());

    expect(result.current.count).toBe(3);
    expect(result.current.allSelected).toBe(true);
  });

  it('clears every row when all are already selected', () => {
    const { result } = renderHook(() => useSelection(rows(1, 2, 3)));

    act(() => result.current.toggleAll());
    act(() => result.current.toggleAll());

    expect(result.current.count).toBe(0);
  });

  it('reports a partial selection as neither all nor none', () => {
    // The header checkbox's third state. Without it, "two of five ticked"
    // renders as an empty box while a bulk action is armed.
    const { result } = renderHook(() => useSelection(rows(1, 2, 3)));

    act(() => result.current.toggle(1));

    expect(result.current.allSelected).toBe(false);
    expect(result.current.someSelected).toBe(true);
  });

  // -- The part that matters ----------------------------------------------

  it('drops a selected id once it is no longer on the page', () => {
    /*
     * The list reloads under the selection whenever a filter, a search or a
     * page changes. An id that survived that would be acted on without being
     * visible — the person would press "delete 3" having been shown one row.
     */
    const { result, rerender } = renderHook(({ items }) => useSelection(items), {
      initialProps: { items: rows(1, 2, 3) },
    });

    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(3);

    // A search narrows the list to one row.
    rerender({ items: rows(2) });

    expect(result.current.ids).toEqual([2]);
    expect(result.current.count).toBe(1);
  });

  it('brings a selection back when the row returns', () => {
    // Clearing the search should not silently have revoked the ticks: the
    // reconciliation filters what is reported, it does not discard state.
    const { result, rerender } = renderHook(({ items }) => useSelection(items), {
      initialProps: { items: rows(1, 2, 3) },
    });

    act(() => result.current.toggleAll());

    rerender({ items: rows(2) });
    expect(result.current.count).toBe(1);

    rerender({ items: rows(1, 2, 3) });
    expect(result.current.count).toBe(3);
  });

  it('is not "all selected" on an empty page', () => {
    // every() on an empty array is true, which would arm a bulk action
    // against nothing and draw a ticked header over no rows.
    const { result } = renderHook(() => useSelection(rows()));

    expect(result.current.allSelected).toBe(false);
    expect(result.current.someSelected).toBe(false);
  });

  it('selecting all on a filtered page adds to what was already selected', () => {
    const { result, rerender } = renderHook(({ items }) => useSelection(items), {
      initialProps: { items: rows(1, 2) },
    });

    act(() => result.current.toggleAll());

    rerender({ items: rows(3, 4) });
    act(() => result.current.toggleAll());

    // Only what is on this page is reported, though all four are held.
    expect(result.current.ids).toEqual([3, 4]);

    rerender({ items: rows(1, 2, 3, 4) });
    expect(result.current.count).toBe(4);
  });

  it('clear empties everything, not only the visible page', () => {
    const { result, rerender } = renderHook(({ items }) => useSelection(items), {
      initialProps: { items: rows(1, 2) },
    });

    act(() => result.current.toggleAll());

    rerender({ items: rows(3) });
    act(() => result.current.clear());

    rerender({ items: rows(1, 2, 3) });
    expect(result.current.count).toBe(0);
  });
});
