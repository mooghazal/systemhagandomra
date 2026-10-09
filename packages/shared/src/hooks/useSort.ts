'use client';

import { useCallback } from 'react';

import type { ResourceState } from './useResource';

/**
 * Column sorting, driven through the filters a list screen already sends.
 *
 * The ordering happens in Laravel, against a per-resource allowlist — the
 * value reaches an ORDER BY clause, which the query builder does not
 * parameterise. Nothing is sorted in the browser: a page holds fifteen rows
 * out of however many exist, and sorting those fifteen would order the page
 * rather than the list, which looks like it worked and is wrong.
 */
export function useSort<T>(state: ResourceState<T>) {
  const active = (state.filters.sort as string | undefined) ?? null;
  const direction = (state.filters.direction as 'asc' | 'desc' | undefined) ?? 'desc';

  const onSort = useCallback(
    (column: string) => {
      /*
       * Clicking the sorted column reverses it; clicking another starts it
       * ascending. Starting a new column descending would show the largest
       * price or the newest date first, which is rarely what somebody who
       * just clicked "name" is after.
       */
      const next = active === column && direction === 'asc' ? 'desc' : 'asc';

      state.setFilter('sort', column);
      state.setFilter('direction', next);
    },
    [active, direction, state],
  );

  return { active, direction, onSort };
}
