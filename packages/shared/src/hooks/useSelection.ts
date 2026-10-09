'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Which rows are ticked, for an action applied to several at once.
 *
 * Holds ids rather than records, so a selection survives the list reloading
 * underneath it — and the ids are reconciled against what is actually on the
 * page, so an id selected before a filter changed cannot be acted on after it
 * has scrolled out of reach.
 *
 * That reconciliation is the whole reason this is a hook rather than a
 * useState in each screen. A bulk delete that operated on a stale id list is
 * the kind of bug that deletes the wrong records and looks like it worked.
 */
export function useSelection<T extends { id: number }>(items: T[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const visible = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  /*
   * Only the ids still on the page. Everything below reads this rather than
   * the raw state, so a selection made before a search narrowed the list
   * cannot be acted on afterwards.
   */
  const effective = useMemo(
    () => new Set([...selected].filter((id) => visible.has(id))),
    [selected, visible],
  );

  const toggle = useCallback((id: number) => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id); else next.add(id);

      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((current) => {
      const everyVisibleSelected = items.length > 0
        && items.every((item) => current.has(item.id));

      // Clearing drops only what is on the page, which is the only thing the
      // checkbox was ever reporting on.
      const next = new Set(current);

      for (const item of items) {
        if (everyVisibleSelected) next.delete(item.id); else next.add(item.id);
      }

      return next;
    });
  }, [items]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const count = effective.size;

  return {
    /** Ids that are both ticked and on the page. */
    ids: useMemo(() => [...effective], [effective]),
    count,
    isSelected: useCallback((id: number) => effective.has(id), [effective]),
    /** True only when every row on the page is ticked. */
    allSelected: items.length > 0 && count === items.length,
    /** Some but not all — the checkbox's indeterminate state. */
    someSelected: count > 0 && count < items.length,
    toggle,
    toggleAll,
    clear,
  };
}
