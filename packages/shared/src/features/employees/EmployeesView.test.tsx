import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { companiesService, employeesService, permissionsService } from '@hagamra/shared/services';
import {
  employeeSession,
  paginated,
  renderScreen,
} from '@hagamra/shared/test/harness';

import { EmployeesView } from './EmployeesView';

vi.mock('@hagamra/shared/services', () => ({
  employeesService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getPermissions: vi.fn(),
    setPermissions: vi.fn(),
  },
  permissionsService: { getAll: vi.fn() },
  companiesService: { getAll: vi.fn() },
}));

const employees = vi.mocked(employeesService);
const permissions = vi.mocked(permissionsService);
const companies = vi.mocked(companiesService);

function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'سالم العتيبي',
    email: 'salem@example.test',
    phone: null,
    role: 'employee' as const,
    role_label: 'موظف',
    is_active: true,
    company_id: 1,
    permissions: ['packages.view'],
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

const CATALOGUE = [
  { id: 1, name: 'packages.view', group: 'packages', label: 'View packages' },
  { id: 2, name: 'packages.create', group: 'packages', label: 'Create packages' },
  { id: 3, name: 'packages.update', group: 'packages', label: 'Update packages' },
  { id: 4, name: 'packages.delete', group: 'packages', label: 'Delete packages' },
  { id: 5, name: 'hotels.view', group: 'hotels', label: 'View hotels' },
];

const PRESETS = [
  { name: 'manager', label: 'Manager', permissions: CATALOGUE.map((p) => p.name) },
  { name: 'viewer', label: 'Read only', permissions: ['packages.view', 'hotels.view'] },
];

/**
 * The employees screen, and the permission dialog that hangs off it.
 *
 * This is the screen where a mistake costs the most: everything it edits
 * decides what somebody else is allowed to do. The dialog only ever ticks
 * boxes — Laravel decides whether the resulting list is allowed — but a
 * dialog that ticks the wrong boxes is how an owner grants something they did
 * not mean to.
 */
describe('EmployeesView', () => {
  beforeEach(() => {
    employees.getAll.mockResolvedValue(paginated([staff()]));
    employees.getPermissions.mockResolvedValue({ permissions: ['packages.view'] });
    permissions.getAll.mockResolvedValue({
      permissions: CATALOGUE,
      groups: {},
      presets: PRESETS,
    });
    companies.getAll.mockResolvedValue(paginated([]));
  });

  const openPermissions = async () => {
    const user = userEvent.setup();

    renderScreen(<EmployeesView />);

    const row = await screen.findByRole('row', { name: /سالم العتيبي/ });

    await user.click(within(row).getByRole('button', { name: /صلاحيات/ }));
    await screen.findByText('ابدأ من مجموعة جاهزة');

    return user;
  };

  // -- The list ------------------------------------------------------------

  it('lists employees with how many permissions each holds', async () => {
    renderScreen(<EmployeesView />);

    expect(await screen.findByText('سالم العتيبي')).toBeTruthy();
    expect(screen.getByText(/1 صلاحية/)).toBeTruthy();
  });

  it('says plainly when an account holds nothing', async () => {
    employees.getAll.mockResolvedValue(paginated([staff({ permissions: [] })]));

    renderScreen(<EmployeesView />);

    expect(await screen.findByText('بلا صلاحيات')).toBeTruthy();
  });

  // -- Who may open the permission dialog ----------------------------------

  it('offers the permission button to an owner', async () => {
    renderScreen(<EmployeesView />);

    const row = await screen.findByRole('row', { name: /سالم العتيبي/ });

    expect(within(row).getByRole('button', { name: /صلاحيات/ })).toBeTruthy();
  });

  it('offers it to a delegate holding employees.permissions', async () => {
    renderScreen(
      <EmployeesView />,
      employeeSession(['employees.view', 'employees.permissions']),
    );

    const row = await screen.findByRole('row', { name: /سالم العتيبي/ });

    expect(within(row).getByRole('button', { name: /صلاحيات/ })).toBeTruthy();
  });

  it('withholds it from an employee who may only edit details', async () => {
    /*
     * Editing somebody's name and deciding what they may do are different
     * powers, and `employees.update` is only the first. Laravel refuses the
     * request either way; not drawing the button means nobody is invited to
     * find that out.
     */
    renderScreen(
      <EmployeesView />,
      employeeSession(['employees.view', 'employees.update']),
    );

    const row = await screen.findByRole('row', { name: /سالم العتيبي/ });

    expect(within(row).queryByRole('button', { name: /صلاحيات/ })).toBeNull();
    expect(within(row).getByRole('button', { name: /تعديل/ })).toBeTruthy();
  });

  // -- The presets ---------------------------------------------------------

  it('shows the presets the backend defined, not a hardcoded list', async () => {
    await openPermissions();

    expect(screen.getByRole('button', { name: /مدير/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /قراءة فقط/ })).toBeTruthy();
  });

  it('applying a preset selects exactly its permissions', async () => {
    const user = await openPermissions();

    await user.click(screen.getByRole('button', { name: /قراءة فقط/ }));

    await waitFor(() => expect(screen.getByText(/2 صلاحية مختارة/)).toBeTruthy());
  });

  it('a preset replaces the selection rather than adding to it', async () => {
    /*
     * The employee starts with packages.view. Applying "read only" must leave
     * them with exactly that preset's two — not three. A preset that only
     * ever added would make it impossible to narrow somebody's access from
     * the dialog that exists to set it.
     */
    const user = await openPermissions();

    await user.click(screen.getByRole('button', { name: /مدير/ }));
    await waitFor(() => expect(screen.getByText(/5 صلاحية مختارة/)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /قراءة فقط/ }));
    await waitFor(() => expect(screen.getByText(/2 صلاحية مختارة/)).toBeTruthy());
  });

  it('marks a preset as current only on an exact match', async () => {
    const user = await openPermissions();

    const readOnly = screen.getByRole('button', { name: /قراءة فقط/ });

    await user.click(readOnly);
    await waitFor(() => expect(readOnly.getAttribute('aria-pressed')).toBe('true'));

    // One extra box ticked and it is no longer that preset.
    await user.click(screen.getByLabelText(/إضافة/, { selector: 'input[type="checkbox"]' }));

    await waitFor(() => expect(readOnly.getAttribute('aria-pressed')).toBe('false'));
  });

  it('a preset is a starting point, and can still be adjusted before saving', async () => {
    employees.setPermissions.mockResolvedValue({ permissions: [] });

    const user = await openPermissions();

    await user.click(screen.getByRole('button', { name: /قراءة فقط/ }));
    await user.click(screen.getByLabelText(/إضافة/, { selector: 'input[type="checkbox"]' }));
    await user.click(screen.getByRole('button', { name: 'حفظ الصلاحيات' }));

    await waitFor(() => expect(employees.setPermissions).toHaveBeenCalled());

    const [, sent] = employees.setPermissions.mock.calls[0]!;

    expect(sent).toContain('packages.create');
    expect(sent).toHaveLength(3);
  });

  // -- Saving --------------------------------------------------------------

  it('sends the whole list, so unticking revokes', async () => {
    employees.setPermissions.mockResolvedValue({ permissions: [] });

    const user = await openPermissions();

    // Clear everything and save: an empty list is a real instruction, not a
    // no-op, and the backend treats it as "revoke all".
    await user.click(screen.getByRole('button', { name: /قراءة فقط/ }));
    await user.click(screen.getByRole('button', { name: /قراءة فقط/ }));

    await user.click(screen.getByRole('button', { name: 'حفظ الصلاحيات' }));

    await waitFor(() => expect(employees.setPermissions).toHaveBeenCalledWith(7, expect.any(Array)));
  });

  it('explains a refusal from the backend', async () => {
    const { ApiError } = await import('@hagamra/shared/lib/api');

    employees.setPermissions.mockRejectedValue(
      new ApiError(403, 'لا يمكنك منح صلاحية لا تملكها.'),
    );

    const user = await openPermissions();

    await user.click(screen.getByRole('button', { name: /مدير/ }));
    await user.click(screen.getByRole('button', { name: 'حفظ الصلاحيات' }));

    expect(await screen.findByText('لا يمكنك منح صلاحية لا تملكها.')).toBeTruthy();
  });
});
