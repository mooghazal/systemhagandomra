import { screen, within } from '@testing-library/react';
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
  statsService: { get: vi.fn(), packagesByType: vi.fn() },
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
    stats.packagesByType.mockResolvedValue({ breakdown: [] });
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
  // -- The breakdown chart -------------------------------------------------

  it('draws the breakdown once there is something to draw', async () => {
    stats.packagesByType.mockResolvedValue({
      breakdown: [{ label: 'عمرة', total: 12 }, { label: 'حج', total: 4 }],
    });

    renderScreen(<DashboardView />);

    expect(await screen.findByText('الباقات حسب نوع الرحلة')).toBeTruthy();
  });

  it('prints every value rather than leaving it to be estimated from a bar', async () => {
    stats.packagesByType.mockResolvedValue({
      breakdown: [{ label: 'عمرة', total: 12 }, { label: 'حج', total: 4 }],
    });

    renderScreen(<DashboardView />);

    await screen.findByText('الباقات حسب نوع الرحلة');

    // Scoped to the chart: the stat tiles above carry numbers of their own.
    const chart = within(screen.getByRole('figure'));

    // Twice each, and that is the design: once beside the bar, once in the
    // table that makes the same data available without the geometry.
    expect(chart.getAllByText('12')).toHaveLength(2);
    expect(chart.getAllByText('4')).toHaveLength(2);
  });

  it('offers the same figures as a table, not only as geometry', async () => {
    // A chart that exists only as bar lengths is unavailable to a screen
    // reader, and unreadable to anyone who wants the number.
    stats.packagesByType.mockResolvedValue({ breakdown: [{ label: 'عمرة', total: 12 }] });

    renderScreen(<DashboardView />);

    await screen.findByText('الباقات حسب نوع الرحلة');

    expect(screen.getByRole('table', { name: /عدد الباقات لكل نوع/ })).toBeTruthy();
  });

  it('draws nothing at all when the catalogue is empty', async () => {
    // An empty chart is a box explaining it has nothing to say.
    stats.packagesByType.mockResolvedValue({ breakdown: [] });

    renderScreen(<DashboardView />);

    await screen.findByText('الباقات');

    expect(screen.queryByText('الباقات حسب نوع الرحلة')).toBeNull();
  });

  it('does not ask for the breakdown without the package permission', async () => {
    renderScreen(<DashboardView />, employeeSession(['hotels.view']));

    await screen.findByText('الفنادق');

    expect(stats.packagesByType).not.toHaveBeenCalled();
  });
});
