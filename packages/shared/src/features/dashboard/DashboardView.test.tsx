import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@hagamra/shared/lib/api';
import { auditLogsService, statsService } from '@hagamra/shared/services';
import {
  employeeSession,
  makeSession,
  makeUser,
  paginated,
  renderScreen,
} from '@hagamra/shared/test/harness';

import { DashboardView } from './DashboardView';

vi.mock('@hagamra/shared/services', () => ({
  statsService: { get: vi.fn() },
  auditLogsService: { getAll: vi.fn() },
}));

const stats = vi.mocked(statsService);
const auditLogs = vi.mocked(auditLogsService);

/**
 * The landing screen.
 *
 * What it shows is decided entirely by who is looking, and getting that wrong
 * leaks the shape of the platform: a company owner who can see how many
 * companies exist has learned something about their competitors.
 */
describe('DashboardView', () => {
  beforeEach(() => {
    stats.get.mockResolvedValue({
      companies: 12, owners: 12, employees: 40, packages: 90, hotels: 30, buses: 15,
    });
    auditLogs.getAll.mockResolvedValue(paginated([]));
  });

  it('greets the person by name', async () => {
    renderScreen(<DashboardView />);

    expect(await screen.findByText(/المستخدم/)).toBeTruthy();
  });

  it('shows an owner their own company and never the platform', async () => {
    renderScreen(<DashboardView />);

    await screen.findByText('الباقات');

    // The counts an owner is entitled to.
    expect(screen.getByText('الفنادق')).toBeTruthy();
    expect(screen.getByText('الموظفون')).toBeTruthy();

    // And the two that would tell them how many other companies exist.
    expect(screen.queryByText('الشركات')).toBeNull();
    expect(screen.queryByText('الملاك')).toBeNull();
  });

  it('shows a super admin the platform-wide tiles', async () => {
    renderScreen(
      <DashboardView />,
      makeSession({
        user: makeUser({
          role: 'super_admin', role_label: 'مشرف عام', company_id: null, company: null,
        }),
      }),
    );

    expect(await screen.findByText('الشركات')).toBeTruthy();
    expect(screen.getByText('الملاك')).toBeTruthy();
  });

  it('shows an employee only the sections they hold', async () => {
    renderScreen(<DashboardView />, employeeSession(['packages.view']));

    expect(await screen.findByText('الباقات')).toBeTruthy();
    expect(screen.queryByText('الفنادق')).toBeNull();
    expect(screen.queryByText('الموظفون')).toBeNull();
  });

  it('does not ask for the audit trail as an employee', async () => {
    /*
     * Reading it is owner-level, so requesting it would be a guaranteed
     * refusal — a 403 in the console and a wasted round trip on every load.
     */
    renderScreen(<DashboardView />, employeeSession(['packages.view']));

    await screen.findByText('الباقات');

    expect(auditLogs.getAll).not.toHaveBeenCalled();
  });

  it('asks for the audit trail as an owner', async () => {
    renderScreen(<DashboardView />);

    await screen.findByText('الباقات');

    expect(auditLogs.getAll).toHaveBeenCalled();
  });

  it('explains a failure instead of showing zeroes', async () => {
    // Zero packages and "we could not find out" are different, and a dashboard
    // that renders the second as the first is lying quietly.
    stats.get.mockRejectedValue(new ApiError(500, 'حدث خطأ غير متوقع.'));

    renderScreen(<DashboardView />);

    expect(await screen.findByText(/حدث خطأ غير متوقع/)).toBeTruthy();
  });

  it('offers a quick action only where the permission to use it exists', async () => {
    renderScreen(<DashboardView />, employeeSession(['packages.view']));

    await screen.findByText('الباقات');

    // Viewing is not creating.
    expect(screen.queryByText('إضافة سريعة')).toBeNull();
  });
});
