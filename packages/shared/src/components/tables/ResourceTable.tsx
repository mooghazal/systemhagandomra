'use client';

import { Search, X } from 'lucide-react';

import { Card, Pagination, Table } from '@hagamra/shared/components/ui/Primitives';
import { EmptyState, ErrorState, TableSkeleton } from '@hagamra/shared/components/ui/Feedback';
import type { ResourceState } from '@hagamra/shared/hooks/useResource';
import { cn } from '@hagamra/shared/lib/cn';

/**
 * The frame every list screen renders inside.
 *
 * It owns the four states a table can be in — loading, failed, empty, has
 * rows — so no individual screen can forget one of them (spec §36–§38).
 */
export function ResourceTable<T>({
  state,
  columns,
  renderRow,
  emptyTitle,
  emptyDescription,
  emptyAction,
  searchPlaceholder = 'بحث…',
  filters,
}: {
  state: ResourceState<T>;
  columns: React.ReactNode;
  renderRow: (item: T) => React.ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
}) {
  const { items, meta, loading, error, search, setSearch, page, setPage, reload } = state;

  const columnCount = Array.isArray(columns) ? columns.length : 5;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle p-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-[var(--radius-base)] border bg-surface px-3 pe-10 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="مسح البحث"
              className="absolute start-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {filters}
      </div>

      {/* A failure replaces the table; a stale list beside an error message is
          worse than no list, because it looks current. */}
      {error ? (
        <ErrorState message={error.message} forbidden={error.isForbidden} onRetry={reload} />
      ) : loading ? (
        <TableSkeleton columns={columnCount} />
      ) : items.length === 0 ? (
        <EmptyState
          title={search ? 'لا توجد نتائج مطابقة' : emptyTitle}
          description={search ? 'جرّب كلمات بحث أخرى.' : emptyDescription}
          action={search ? undefined : emptyAction}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>{columns}</tr>
            </thead>
            <tbody>{items.map((item) => renderRow(item))}</tbody>
          </Table>

          <Pagination
            page={page}
            lastPage={meta.last_page}
            total={meta.total}
            perPage={meta.per_page}
            onChange={setPage}
          />
        </>
      )}
    </Card>
  );
}

/** Row actions, kept to a consistent size and spacing across screens. */
export function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-end gap-1', className)}>{children}</div>;
}
