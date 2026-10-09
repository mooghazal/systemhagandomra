import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@hagamra/shared/lib/api';
import { hotelsService } from '@hagamra/shared/services';
import { employeeSession, paginated, renderScreen } from '@hagamra/shared/test/harness';

import { HotelsView } from './HotelsView';

vi.mock('@hagamra/shared/services', () => ({
  hotelsService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  companiesService: { getAll: vi.fn() },
}));

const service = vi.mocked(hotelsService);

function hotel(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    company_id: 1,
    name: 'فندق أنوار المدينة',
    location: 'المدينة المنورة',
    description: null,
    distance_from_haram: null,
    distance_from_masjid_nabawi: 300,
    rating: 4,
    room_type: null,
    features: [],
    image_path: null,
    image_url: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * Hotels follow the same shape as packages, so these cover what is specific
 * to them: the rating, and the two distances that are mutually exclusive in
 * practice — a Makkah hotel has no distance to the Prophet's Mosque.
 */
describe('HotelsView', () => {
  beforeEach(async () => {
    service.getAll.mockResolvedValue(paginated([hotel()]));

    const { companiesService } = await import('@hagamra/shared/services');
    vi.mocked(companiesService).getAll.mockResolvedValue(paginated([]));
  });

  it('lists hotels with their rating', async () => {
    renderScreen(<HotelsView />);

    expect(await screen.findByText('فندق أنوار المدينة')).toBeTruthy();
    expect(screen.getByText('المدينة المنورة')).toBeTruthy();
  });

  it('shows an unrated hotel as unspecified rather than as zero stars', async () => {
    // No rating is a fact about the data, not a rating of nothing.
    service.getAll.mockResolvedValue(paginated([hotel({ rating: null })]));

    renderScreen(<HotelsView />);

    const row = await screen.findByRole('row', { name: /فندق أنوار المدينة/ });

    expect(within(row).getAllByTitle('غير محدّد').length).toBeGreaterThan(0);
  });

  it('leaves the distance a hotel does not have blank', async () => {
    renderScreen(<HotelsView />);

    const row = await screen.findByRole('row', { name: /فندق أنوار المدينة/ });

    // 300m from the Prophet's Mosque, nothing from the Haram.
    expect(within(row).getByText(/300/)).toBeTruthy();
  });

  it('creates a hotel with only a name', async () => {
    service.create.mockResolvedValue(hotel({ id: 4 }));

    const user = userEvent.setup();

    renderScreen(<HotelsView />);
    await screen.findByText('فندق أنوار المدينة');

    await user.click(screen.getByRole('button', { name: /إضافة فندق/ }));
    await user.type(screen.getByPlaceholderText(/مثال: سويس أوتيل/), 'فندق جديد');

    const dialog = screen.getByRole('dialog');
    const saves = within(dialog).getAllByRole('button', { name: 'إضافة' });

    await user.click(saves[saves.length - 1]!);

    await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));
  });

  it('surfaces a refusal rather than an empty table', async () => {
    service.getAll.mockRejectedValue(new ApiError(403, 'ليست لديك صلاحية.'));

    renderScreen(<HotelsView />);

    expect(await screen.findByText('ليست لديك صلاحية.')).toBeTruthy();
  });

  it('hides every control from a read-only employee', async () => {
    renderScreen(<HotelsView />, employeeSession(['hotels.view']));

    const row = await screen.findByRole('row', { name: /فندق أنوار المدينة/ });

    expect(screen.queryByRole('button', { name: /إضافة فندق/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /تعديل/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /حذف/ })).toBeNull();
  });
});
