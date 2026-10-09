import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { busesService, companiesService } from '@hagamra/shared/services';
import { employeeSession, paginated, renderScreen } from '@hagamra/shared/test/harness';

import { BusesView } from './BusesView';

vi.mock('@hagamra/shared/services', () => ({
  busesService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  companiesService: { getAll: vi.fn() },
}));

const service = vi.mocked(busesService);

function bus(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    company_id: 1,
    name: 'حافلة مرسيدس توريزمو',
    type: 'VIP',
    capacity: 45,
    model: null,
    description: null,
    features: [],
    image_path: null,
    image_url: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe('BusesView', () => {
  beforeEach(() => {
    service.getAll.mockResolvedValue(paginated([bus()]));
    vi.mocked(companiesService).getAll.mockResolvedValue(paginated([]));
  });

  it('lists buses with their capacity', async () => {
    renderScreen(<BusesView />);

    expect(await screen.findByText('حافلة مرسيدس توريزمو')).toBeTruthy();
    expect(screen.getByText(/45/)).toBeTruthy();
  });

  it('shows a bus with no capacity recorded as unspecified', async () => {
    /*
     * Not as zero. A bus that seats nobody and a bus whose capacity was never
     * entered are different facts, and showing 0 for the second is a lie the
     * person reading has no way to catch.
     */
    service.getAll.mockResolvedValue(paginated([bus({ capacity: null })]));

    renderScreen(<BusesView />);

    const row = await screen.findByRole('row', { name: /حافلة مرسيدس/ });

    expect(within(row).getAllByTitle('غير محدّد').length).toBeGreaterThan(0);
  });

  it('creates a bus', async () => {
    service.create.mockResolvedValue(bus({ id: 6 }));

    const user = userEvent.setup();

    renderScreen(<BusesView />);
    await screen.findByText('حافلة مرسيدس توريزمو');

    await user.click(screen.getByRole('button', { name: /إضافة حافلة/ }));
    await user.type(screen.getByPlaceholderText(/مثال: حافلة/), 'حافلة جديدة');

    const dialog = screen.getByRole('dialog');
    const saves = within(dialog).getAllByRole('button', { name: 'إضافة' });

    await user.click(saves[saves.length - 1]!);

    await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
  });

  it('shows the empty state when the fleet is empty', async () => {
    service.getAll.mockResolvedValue(paginated([]));

    renderScreen(<BusesView />);

    expect(await screen.findByText(/لا توجد حافلات/)).toBeTruthy();
  });

  it('hides every control from a read-only employee', async () => {
    renderScreen(<BusesView />, employeeSession(['buses.view']));

    const row = await screen.findByRole('row', { name: /حافلة مرسيدس/ });

    expect(screen.queryByRole('button', { name: /إضافة حافلة/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /حذف/ })).toBeNull();
  });
});
