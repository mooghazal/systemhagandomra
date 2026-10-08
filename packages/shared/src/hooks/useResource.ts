'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@hagamra/shared/lib/api';
import type { Paginated, PaginationMeta } from '@hagamra/shared/types';

/**
 * List state for every table screen: rows, paging, search, loading, failure.
 *
 * Written once because packages, hotels, buses, employees, owners, companies
 * and audit logs all need exactly this and differ only in which service they
 * call (spec §49, §56).
 */

const EMPTY_META: PaginationMeta = {
  current_page: 1,
  per_page: 15,
  total: 0,
  last_page: 1,
};

export interface ResourceState<T> {
  items: T[];
  meta: PaginationMeta;
  loading: boolean;
  error: ApiError | null;
  page: number;
  search: string;
  filters: Record<string, unknown>;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: unknown) => void;
  reload: () => void;
}

export function useResource<T>(
  fetcher: (query: Record<string, unknown>, signal?: AbortSignal) => Promise<Paginated<T>>,
  initialFilters: Record<string, unknown> = {},
): ResourceState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [page, setPageState] = useState(1);
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [nonce, setNonce] = useState(0);

  // The fetcher is usually an inline arrow, so a new identity on every render.
  // Holding it in a ref keeps it out of the effect's dependencies and stops
  // the request from firing in a loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Typing should not fire a request per keystroke (§56).
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // A new search or filter invalidates whatever page we were on.
  useEffect(() => {
    setPageState(1);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);

    fetcherRef
      .current({ page, search: debouncedSearch, ...filters }, controller.signal)
      .then((result) => {
        if (cancelled) return;

        setItems(result.items);
        setMeta(result.meta);
        setError(null);
      })
      .catch((caught: unknown) => {
        // An aborted request is this component moving on, not a failure.
        if (cancelled || (caught instanceof DOMException && caught.name === 'AbortError')) return;

        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError(0, 'تعذّر تحميل البيانات. يرجى المحاولة مرة أخرى.'),
        );
        setItems([]);
        setMeta(EMPTY_META);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Drops the answer to a question we no longer care about, so a slow
      // earlier response cannot overwrite a newer one.
      controller.abort();
    };
  }, [page, debouncedSearch, filters, nonce]);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilters((current) => {
      const next = { ...current };

      if (value === '' || value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }

      return next;
    });
  }, []);

  return {
    items,
    meta,
    loading,
    error,
    page,
    search,
    filters,
    setPage: setPageState,
    setSearch: setSearchState,
    setFilter,
    reload: useCallback(() => setNonce((value) => value + 1), []),
  };
}
