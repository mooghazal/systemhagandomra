import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@hagamra/shared/lib/api';
import { companiesService, packagesService } from '@hagamra/shared/services';
import {
  employeeSession,
  makeSession,
  makeUser,
  paginated,
  renderScreen,
} from '@hagamra/shared/test/harness';

import { PackagesView } from './PackagesView';

vi.mock('@hagamra/shared/services', () => ({
  packagesService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  companiesService: { getAll: vi.fn() },
}));

const service = vi.mocked(packagesService);
const companies = vi.mocked(companiesService);

/**
 * The dialog's save button.
 *
 * Named by `getAllByRole` rather than `getByRole` because the feature picker
 * inside the form has its own إضافة button. The footer is the last thing in
 * the dialog, so the last match is the one that submits.
 */
function saveButton(label = 'إضافة'): HTMLElement {
  const dialog = screen.getByRole('dialog');
  const matches = within(dialog).getAllByRole('button', { name: label });

  return matches[matches.length - 1]!;
}

function pkg(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    company_id: 1,
    name: 'عمرة رمضان',
    description: null,
    price: 25000,
    currency: 'SAR',
    days: 14,
    start_date: null,
    end_date: null,
    trip_type: 'عمرة',
    location: 'مكة المكرمة',
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
 * The packages screen.
 *
 * This is the shape every resource screen follows, and the one where three
 * real bugs lived: a dialog taller than the window, an error that was set but
 * never scrolled to, and a toast painted underneath a modal. All three looked
 * identical from the outside — "I press Add and nothing happens" — so the
 * tests that matter here are the ones about what the screen *says* when a save
 * is refused.
 */
describe('PackagesView', () => {
  beforeEach(() => {
    service.getAll.mockResolvedValue(paginated([pkg()]));
    // Only a super admin's dialog reads this, but the effect that fetches it
    // runs on every render.
    companies.getAll.mockResolvedValue(paginated([]));
  });

  const open = async () => {
    const user = userEvent.setup();

    renderScreen(<PackagesView />);

    await screen.findByText('عمرة رمضان');
    await user.click(screen.getByRole('button', { name: /إضافة باقة/ }));

    return user;
  };

  // -- Reading -------------------------------------------------------------

  it('lists what the backend returned', async () => {
    renderScreen(<PackagesView />);

    expect(await screen.findByText('عمرة رمضان')).toBeTruthy();
    expect(screen.getByText('مكة المكرمة')).toBeTruthy();
  });

  it('shows the empty state rather than a bare table', async () => {
    service.getAll.mockResolvedValue(paginated([]));

    renderScreen(<PackagesView />);

    expect(await screen.findByText(/لا توجد باقات/)).toBeTruthy();
  });

  it('explains a refusal instead of showing an empty list', async () => {
    service.getAll.mockRejectedValue(new ApiError(403, 'ليست لديك صلاحية.'));

    renderScreen(<PackagesView />);

    expect(await screen.findByText('ليست لديك صلاحية.')).toBeTruthy();
  });

  // -- Writing -------------------------------------------------------------

  it('creates a package from the dialog', async () => {
    service.create.mockResolvedValue(pkg({ id: 2, name: 'حج التمتع' }));

    const user = await open();

    await user.type(screen.getByPlaceholderText(/مثال: عمرة رمضان/), 'حج التمتع');
    await user.click(saveButton());

    await waitFor(() => expect(service.create).toHaveBeenCalledTimes(1));

    // The list is refetched rather than patched, so what is on screen is what
    // the backend has.
    await waitFor(() => expect(service.getAll).toHaveBeenCalledTimes(2));
  });

  it('sends an untouched optional field as absent, not as empty', async () => {
    /*
     * The backend reads an omitted field as "leave it alone" and an explicit
     * null as "clear it" (spec §15). Sending empty strings for everything the
     * person did not fill in would turn a create into a wall of nulls and an
     * edit into silent data loss.
     */
    service.create.mockResolvedValue(pkg({ id: 2 }));

    const user = await open();

    await user.type(screen.getByPlaceholderText(/مثال: عمرة رمضان/), 'باقة بالاسم فقط');
    await user.click(saveButton());

    await waitFor(() => expect(service.create).toHaveBeenCalled());

    const body = service.create.mock.calls[0]![0] as FormData;

    expect(body.get('name')).toBe('باقة بالاسم فقط');

    /*
     * An empty optional field is sent as an empty string, which Laravel's
     * `nullable` reads as null — an explicit "this is blank" rather than an
     * omission. That distinction is the point on an edit: omitting a field
     * means leave it alone, so clearing one has to say so.
     */
    expect(body.get('description')).toBe('');
    expect(body.get('price')).toBe('');
  });

  // -- When the backend says no --------------------------------------------

  it('puts a rejected field in view, with the backend wording', async () => {
    /*
     * The bug this is here for: the message was rendered, at the top of a
     * form whose save button is at the bottom, and the dialog stayed open —
     * so the screen looked like a dead button.
     */
    service.create.mockRejectedValue(
      Object.assign(new ApiError(422, 'البيانات غير صحيحة.'), {
        errors: { name: ['حقل الاسم مطلوب.'] },
      }),
    );

    const user = await open();

    await user.type(screen.getByPlaceholderText(/مثال: عمرة رمضان/), 'x');
    await user.click(saveButton());

    const message = await screen.findByText('حقل الاسم مطلوب.');

    expect(message.getAttribute('role')).toBe('alert');

    // And the dialog stays open, so the typing is not lost.
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps what was typed when a save is refused', async () => {
    service.create.mockRejectedValue(
      Object.assign(new ApiError(422, 'خطأ'), { errors: { price: ['غير صالح.'] } }),
    );

    const user = await open();

    const name = screen.getByPlaceholderText(/مثال: عمرة رمضان/) as HTMLInputElement;

    await user.type(name, 'باقة محفوظة');
    await user.click(saveButton());

    await screen.findByText('غير صالح.');

    expect(name.value).toBe('باقة محفوظة');
  });

  it('reports a server error rather than failing silently', async () => {
    service.create.mockRejectedValue(new ApiError(500, 'حدث خطأ غير متوقع.'));

    const user = await open();

    await user.type(screen.getByPlaceholderText(/مثال: عمرة رمضان/), 'باقة');
    await user.click(saveButton());

    expect(await screen.findByText(/حدث خطأ غير متوقع/)).toBeTruthy();
  });

  // -- Permissions ---------------------------------------------------------

  it('offers no add button to someone who may only read', async () => {
    renderScreen(<PackagesView />, employeeSession(['packages.view']));

    await screen.findByText('عمرة رمضان');

    expect(screen.queryByRole('button', { name: /إضافة باقة/ })).toBeNull();
  });

  it('offers no row actions to someone who may only read', async () => {
    renderScreen(<PackagesView />, employeeSession(['packages.view']));

    const row = await screen.findByRole('row', { name: /عمرة رمضان/ });

    expect(within(row).queryByRole('button', { name: /تعديل/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /حذف/ })).toBeNull();
  });

  it('offers edit but not delete to someone granted only update', async () => {
    renderScreen(<PackagesView />, employeeSession(['packages.view', 'packages.update']));

    const row = await screen.findByRole('row', { name: /عمرة رمضان/ });

    expect(within(row).getByRole('button', { name: /تعديل/ })).toBeTruthy();
    expect(within(row).queryByRole('button', { name: /حذف/ })).toBeNull();
  });

  // -- Deleting -------------------------------------------------------------

  it('asks before deleting, and names the record', async () => {
    const user = userEvent.setup();

    renderScreen(<PackagesView />);

    const row = await screen.findByRole('row', { name: /عمرة رمضان/ });

    await user.click(within(row).getByRole('button', { name: /حذف/ }));

    // Named inside the confirmation, so there is no doubt about which one.
    // Scoped to the dialog because the filter dropdown offers a trip type by
    // the same name.
    const confirmation = await screen.findByRole('dialog');

    expect(within(confirmation).getByText(/عمرة رمضان/)).toBeTruthy();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('deletes only after the confirmation is accepted', async () => {
    service.delete.mockResolvedValue(undefined);

    const user = userEvent.setup();

    renderScreen(<PackagesView />);

    const row = await screen.findByRole('row', { name: /عمرة رمضان/ });

    await user.click(within(row).getByRole('button', { name: /حذف/ }));
    await user.click(await screen.findByRole('button', { name: 'حذف' }));

    await waitFor(() => expect(service.delete).toHaveBeenCalledWith(1));
  });

  // -- The super admin's extra step ----------------------------------------

  it('makes a super admin choose a company', async () => {
    const user = userEvent.setup();

    renderScreen(
      <PackagesView />,
      makeSession({
        user: makeUser({ role: 'super_admin', role_label: 'مشرف عام', company_id: null, company: null }),
      }),
    );

    await screen.findByText('عمرة رمضان');
    await user.click(screen.getByRole('button', { name: /إضافة باقة/ }));

    // Nobody can guess which company a package belongs to, so it is asked.
    expect(screen.getByLabelText(/الشركة/)).toBeTruthy();
  });
});
