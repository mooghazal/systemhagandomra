import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../lib/api';
import type { ResourceState } from '../../hooks/useResource';
import { Td, Th, Tr } from '../ui/Primitives';

import { ResourceTable } from './ResourceTable';

/**
 * The four states a list screen can be in (spec §36–§38).
 *
 * The frame owns all of them so no individual screen can forget one — these
 * tests are what makes that claim true rather than aspirational.
 */

interface Row {
  id: number;
  name: string;
}

function makeState(overrides: Partial<ResourceState<Row>> = {}): ResourceState<Row> {
  return {
    items: [],
    meta: { current_page: 1, per_page: 15, total: 0, last_page: 1 },
    loading: false,
    error: null,
    page: 1,
    search: '',
    filters: {},
    setPage: vi.fn(),
    setSearch: vi.fn(),
    setFilter: vi.fn(),
    reload: vi.fn(),
    ...overrides,
  };
}

function renderTable(state: ResourceState<Row>, emptyAction?: React.ReactNode) {
  return render(
    <ResourceTable
      state={state}
      columns={<><Th>الاسم</Th><Th>إجراءات</Th></>}
      renderRow={(row) => <Tr key={row.id}><Td>{row.name}</Td><Td /></Tr>}
      emptyTitle="لا توجد باقات"
      emptyDescription="ابدأ بإضافة أول باقة."
      emptyAction={emptyAction}
    />,
  );
}

describe('ResourceTable', () => {
  it('shows a skeleton while loading, not an empty state', () => {
    renderTable(makeState({ loading: true }));

    // "No packages" during the first load is a lie that makes people navigate away.
    expect(screen.queryByText('لا توجد باقات')).toBeNull();
    expect(screen.getByText('جارٍ تحميل البيانات')).toBeTruthy();
  });

  it('shows the rows once they arrive', () => {
    renderTable(makeState({
      items: [{ id: 1, name: 'عمرة رمضان' }, { id: 2, name: 'حج اقتصادي' }],
      meta: { current_page: 1, per_page: 15, total: 2, last_page: 1 },
    }));

    expect(screen.getByText('عمرة رمضان')).toBeTruthy();
    expect(screen.getByText('حج اقتصادي')).toBeTruthy();
  });

  it('offers the add button when there is genuinely nothing yet', () => {
    renderTable(makeState(), <button type="button">إضافة باقة</button>);

    expect(screen.getByText('لا توجد باقات')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'إضافة باقة' })).toBeTruthy();
  });

  it('does not offer the add button when a search simply matched nothing', () => {
    renderTable(makeState({ search: 'لا شيء' }), <button type="button">إضافة باقة</button>);

    // Nothing is missing here — the filter is just narrow. Offering "add"
    // invites someone to create a duplicate of what they were looking for.
    expect(screen.getByText('لا توجد نتائج مطابقة')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'إضافة باقة' })).toBeNull();
  });

  it('replaces the table with the failure, rather than showing both', () => {
    renderTable(makeState({
      error: new ApiError(500, 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'),
      items: [{ id: 1, name: 'بيانات قديمة' }],
    }));

    // A stale list beside an error message is worse than no list: it looks current.
    expect(screen.queryByText('بيانات قديمة')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('خطأ غير متوقع');
  });

  it('offers a retry on a failure that retrying could fix', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();

    renderTable(makeState({ error: new ApiError(500, 'تعذّر التحميل.'), reload }));

    await user.click(screen.getByRole('button', { name: /إعادة المحاولة/ }));

    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not offer a retry on a permission refusal', () => {
    renderTable(makeState({
      error: new ApiError(403, 'ليست لديك صلاحية لتنفيذ هذا الإجراء.'),
    }));

    // Retrying will refuse again; a button that cannot help is noise.
    expect(screen.queryByRole('button', { name: /إعادة المحاولة/ })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('صلاحية');
  });

  it('reports the range being shown and moves between pages', async () => {
    const user = userEvent.setup();
    const setPage = vi.fn();

    renderTable(makeState({
      items: [{ id: 1, name: 'أ' }],
      meta: { current_page: 2, per_page: 15, total: 40, last_page: 3 },
      page: 2,
      setPage,
    }));

    expect(screen.getByText('16')).toBeTruthy();   // from
    expect(screen.getByText('40')).toBeTruthy();   // total

    await user.click(screen.getByRole('button', { name: 'الصفحة التالية' }));
    expect(setPage).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'الصفحة السابقة' }));
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('disables paging at the ends', () => {
    renderTable(makeState({
      items: [{ id: 1, name: 'أ' }],
      meta: { current_page: 1, per_page: 15, total: 5, last_page: 1 },
    }));

    expect(screen.getByRole('button', { name: 'الصفحة السابقة' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'الصفحة التالية' }).hasAttribute('disabled')).toBe(true);
  });

  it('passes typing through to the search', async () => {
    const user = userEvent.setup();
    const setSearch = vi.fn();

    renderTable(makeState({ setSearch }));

    await user.type(screen.getByRole('searchbox'), 'ر');

    expect(setSearch).toHaveBeenCalledWith('ر');
  });
});
