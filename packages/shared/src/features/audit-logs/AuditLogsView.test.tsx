import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLogsService } from '@hagamra/shared/services';
import { makeSession, makeUser, paginated, renderScreen } from '@hagamra/shared/test/harness';

import { AuditLogsView } from './AuditLogsView';

vi.mock('@hagamra/shared/services', () => ({
  auditLogsService: { getAll: vi.fn() },
  companiesService: { getAll: vi.fn() },
}));

const service = vi.mocked(auditLogsService);

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    action: 'created',
    resource_type: 'package',
    resource_id: 4,
    source: 'dashboard' as const,
    company_id: 1,
    ip_address: '127.0.0.1',
    created_at: '2026-10-09T08:00:00Z',
    actor: { id: 2, name: 'سالم العتيبي', email: 'salem@example.test', role: 'employee' },
    company: { id: 1, name: 'شركة الاختبار' },
    metadata: null,
    ...overrides,
  };
}

/**
 * The audit trail.
 *
 * Its value is that it answers "who did this, and how" — so the test that
 * matters is that a change made through the AI agent is distinguishable from
 * one a person made by hand. If those look the same, the column is decoration.
 */
describe('AuditLogsView', () => {
  beforeEach(async () => {
    service.getAll.mockResolvedValue(paginated([entry()]));

    const { companiesService } = await import('@hagamra/shared/services');
    vi.mocked(companiesService).getAll.mockResolvedValue(paginated([]));
  });

  it('shows who acted and on what', async () => {
    renderScreen(<AuditLogsView />);

    expect(await screen.findByText('سالم العتيبي')).toBeTruthy();
  });

  it('calls out a change made through the agent', async () => {
    service.getAll.mockResolvedValue(paginated([entry({ source: 'mcp_agent' })]));

    renderScreen(<AuditLogsView />);

    expect(await screen.findByText(/المساعد|الوكيل|mcp/i)).toBeTruthy();
  });

  it('shows the empty state before anything has happened', async () => {
    service.getAll.mockResolvedValue(paginated([]));

    renderScreen(<AuditLogsView />);

    expect(await screen.findByText(/لا توجد عمليات/)).toBeTruthy();
  });

  it('offers a super admin the company filter', async () => {
    renderScreen(
      <AuditLogsView />,
      makeSession({
        user: makeUser({
          role: 'super_admin', role_label: 'مشرف عام', company_id: null, company: null,
        }),
      }),
    );

    await screen.findByText('سالم العتيبي');

    expect(screen.getByLabelText(/تصفية بالشركة/)).toBeTruthy();
  });

  it('does not offer an owner a company filter', async () => {
    // There is only one company they can see, so a filter would be a control
    // that does nothing.
    renderScreen(<AuditLogsView />);

    await screen.findByText('سالم العتيبي');

    expect(screen.queryByLabelText(/تصفية بالشركة/)).toBeNull();
  });
});
