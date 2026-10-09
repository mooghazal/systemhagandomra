import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { employeeSession, makeSession, makeUser, renderScreen } from '@hagamra/shared/test/harness';

import { SettingsView } from './SettingsView';

/**
 * The settings screen is a set of links, so what it is for is deciding which
 * ones to show. A link to a page that will answer "forbidden" is worse than no
 * link: it tells someone a door exists and then refuses them at it.
 */
describe('SettingsView', () => {
  it('offers the employee and audit links to an owner', () => {
    renderScreen(<SettingsView />);

    expect(screen.getByText(/الموظفون/)).toBeTruthy();
    expect(screen.getByText(/سجل العمليات/)).toBeTruthy();
  });

  it('withholds the audit link from an employee', () => {
    // Reading the trail is owner-level.
    renderScreen(<SettingsView />, employeeSession(['packages.view']));

    expect(screen.queryByText(/سجل العمليات/)).toBeNull();
  });

  it('withholds the employees link from someone who cannot view them', () => {
    renderScreen(<SettingsView />, employeeSession(['packages.view']));

    expect(screen.queryByText(/إدارة الموظفين|الموظفون/)).toBeNull();
  });

  it('shows a super admin everything', () => {
    renderScreen(
      <SettingsView />,
      makeSession({
        user: makeUser({
          role: 'super_admin', role_label: 'مشرف عام', company_id: null, company: null,
        }),
      }),
    );

    expect(screen.getByText(/سجل العمليات/)).toBeTruthy();
  });
});
