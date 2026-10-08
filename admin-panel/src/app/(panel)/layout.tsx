import { AdminShell } from '@/components/layout/AdminShell';
import { SessionProvider } from '@hagamra/shared/hooks/useSession';
import { requireSession } from '@hagamra/shared/lib/server-api';

/**
 * Wraps every admin page.
 *
 * The session is fetched here, on the server, on each navigation — so Laravel
 * confirms the token is still good before a single pixel renders, and an
 * account disabled a moment ago is signed out on its next click rather than
 * whenever the panel happens to ask.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <SessionProvider session={session}>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
