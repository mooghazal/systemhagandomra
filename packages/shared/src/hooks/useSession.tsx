'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';

import { authService } from '@hagamra/shared/services';
import type { Session, User } from '@hagamra/shared/types';

/**
 * Who is signed in, and what they are allowed to see.
 *
 * The session is fetched once on the server and handed down, so no screen has
 * to wait on a round trip to know whether to render a button.
 *
 * Everything here is for presentation. A permission missing from this list
 * hides a control; it does not protect anything. Laravel re-checks the same
 * permission on every request, and that check is the one that matters — the
 * panel could be rewritten to show every button and still change nothing about
 * what the backend allows (spec §5, §8, §50).
 */

interface SessionApi {
  user: User;
  permissions: string[];
  /** Whether the UI should offer the action behind this permission. */
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

export function useSession(): SessionApi {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>.');
  }

  return context;
}

export function SessionProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const logout = useCallback(async () => {
    await authService.logout();

    // A hard navigation, not router.push: it drops every cached page and
    // in-memory state belonging to the person signing out.
    window.location.href = '/login';
  }, []);

  const value = useMemo<SessionApi>(() => {
    const granted = new Set(session.permissions);

    return {
      user: session.user,
      permissions: session.permissions,
      can: (permission) => granted.has(permission),
      canAny: (...permissions) => permissions.some((permission) => granted.has(permission)),
      isSuperAdmin: session.user.role === 'super_admin',
      logout,
    };
  }, [session, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
