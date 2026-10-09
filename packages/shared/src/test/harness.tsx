import { render } from '@testing-library/react';

import { ToastProvider } from '@hagamra/shared/components/ui/Toast';
import { SessionProvider } from '@hagamra/shared/hooks/useSession';
import type { Session, User, UserRole } from '@hagamra/shared/types';

/**
 * What a feature screen needs around it to render.
 *
 * Every one of them reads the session, raises toasts and reads the query
 * string, so testing any of them means standing all three up. Without this
 * each test file would carry forty lines of setup, and the eight of them
 * would drift apart until a change to the session shape broke seven in
 * different ways.
 */

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'المستخدم',
    email: 'user@example.test',
    phone: null,
    role: 'owner' as UserRole,
    role_label: 'مالك الشركة',
    is_active: true,
    company_id: 1,
    company: {
      id: 1,
      name: 'شركة الاختبار',
      slug: 'test',
      domain: null,
      email: null,
      phone: null,
      address: null,
      logo_path: null,
      logo_url: null,
      is_active: true,
      created_at: null,
      updated_at: null,
    },
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * Every permission in the catalogue.
 *
 * `can()` is a set lookup over whatever the backend sent — it does not know
 * about roles. An owner holds everything inside their company, and
 * `effectivePermissions()` is what expands that into the list the panel
 * receives, so a test session for an owner has to carry the same list or the
 * screens hide controls the real one shows.
 */
export const ALL_PERMISSIONS = [
  'employees.view', 'employees.create', 'employees.update', 'employees.delete',
  'employees.permissions',
  'packages.view', 'packages.create', 'packages.update', 'packages.delete',
  'hotels.view', 'hotels.create', 'hotels.update', 'hotels.delete',
  'buses.view', 'buses.create', 'buses.update', 'buses.delete',
];

export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    user: makeUser(overrides.user),
    permissions: ALL_PERMISSIONS,
    ...overrides,
  };
}

/** A session for an employee holding exactly these permissions. */
export function employeeSession(permissions: string[]): Session {
  return makeSession({
    user: makeUser({ role: 'employee' as UserRole, role_label: 'موظف' }),
    permissions,
  });
}

export function renderScreen(ui: React.ReactElement, session: Session = makeSession()) {
  return render(
    <SessionProvider session={session}>
      <ToastProvider>{ui}</ToastProvider>
    </SessionProvider>,
  );
}

/**
 * A paginated envelope, the shape every list service returns.
 */
export function paginated<T>(items: T[], total = items.length) {
  return {
    items,
    meta: { current_page: 1, per_page: 15, total, last_page: Math.max(1, Math.ceil(total / 15)) },
  };
}
