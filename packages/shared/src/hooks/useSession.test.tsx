import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Session, User } from '@hagamra/shared/types';

import { SessionProvider, useSession } from './useSession';

/**
 * The permission helpers decide which controls appear.
 *
 * Worth saying plainly: these tests cover *presentation*. A bug here shows
 * someone a button they cannot use, which is a poor experience, not a breach —
 * Laravel refuses the request either way. The tenant-isolation tests in the
 * backend suite are the ones that cover access.
 */

function makeSession(role: User['role'], permissions: string[]): Session {
  return {
    user: {
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
      phone: null,
      role,
      role_label: role,
      is_active: true,
      company_id: role === 'super_admin' ? null : 1,
      created_at: null,
      updated_at: null,
    },
    permissions,
  };
}

function Probe() {
  const { can, canAny, isSuperAdmin } = useSession();

  return (
    <ul>
      <li data-testid="view">{String(can('packages.view'))}</li>
      <li data-testid="create">{String(can('packages.create'))}</li>
      <li data-testid="any">{String(canAny('packages.create', 'hotels.create'))}</li>
      <li data-testid="super">{String(isSuperAdmin)}</li>
    </ul>
  );
}

const renderWith = (session: Session) =>
  render(
    <SessionProvider session={session}>
      <Probe />
    </SessionProvider>,
  );

describe('useSession', () => {
  it('grants exactly the permissions the backend listed', () => {
    renderWith(makeSession('employee', ['packages.view']));

    expect(screen.getByTestId('view').textContent).toBe('true');
    expect(screen.getByTestId('create').textContent).toBe('false');
  });

  it('does not infer write access from read access', () => {
    renderWith(makeSession('employee', ['packages.view', 'hotels.view']));

    expect(screen.getByTestId('any').textContent).toBe('false');
  });

  it('canAny is true when any one permission is held', () => {
    renderWith(makeSession('employee', ['hotels.create']));

    expect(screen.getByTestId('any').textContent).toBe('true');
  });

  it('gives an employee with no grants nothing', () => {
    renderWith(makeSession('employee', []));

    expect(screen.getByTestId('view').textContent).toBe('false');
    expect(screen.getByTestId('create').textContent).toBe('false');
    expect(screen.getByTestId('super').textContent).toBe('false');
  });

  it('flags a super admin', () => {
    renderWith(makeSession('super_admin', ['packages.view', 'packages.create']));

    expect(screen.getByTestId('super').textContent).toBe('true');
  });

  it('does not treat an owner as a super admin', () => {
    // An owner holds every permission inside their company, which the backend
    // expands for them — but they are not system-level.
    renderWith(makeSession('owner', ['packages.view', 'packages.create']));

    expect(screen.getByTestId('super').textContent).toBe('false');
    expect(screen.getByTestId('create').textContent).toBe('true');
  });

  it('reads permissions from the list, never from the role', () => {
    // A role is not a shortcut: if the backend did not list it, it is not held.
    renderWith(makeSession('owner', []));

    expect(screen.getByTestId('view').textContent).toBe('false');
  });
});
