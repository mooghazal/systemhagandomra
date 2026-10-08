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

        // A hard navigation on purpose, which is why the rule is waived here:
        // router.push() would keep this tab's React tree and every cached
        // response in memory, so the next person to sign in would start from
        // the previous account's state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }}
    >
      تسجيل الخروج
    </Button>
  );
}
