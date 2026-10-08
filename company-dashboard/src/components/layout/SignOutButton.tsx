'use client';

import { useState } from 'react';

import { Button } from '@hagamra/shared/components/ui/Button';
import { authService } from '@hagamra/shared/services';

/**
 * Sign out from a page that has no session context — the super-admin notice,
 * which renders outside SessionProvider.
 */
export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await authService.logout();

        // A hard navigation, so nothing from the previous account survives.
        window.location.href = '/login';
      }}
    >
      تسجيل الخروج
    </Button>
  );
}
