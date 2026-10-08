import { SessionProvider } from '@hagamra/shared/hooks/useSession';
import { requireSession } from '@hagamra/shared/lib/server-api';

import { CompanyShell } from '@/components/layout/CompanyShell';
import { SignOutButton } from '@/components/layout/SignOutButton';

/**
 * Wraps every page in the company dashboard.
 *
 * The session is fetched here, on the server, on each navigation — so Laravel
 * confirms the token is still good before a single pixel renders, and an
 * account disabled a moment ago is signed out on its next click.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  /*
   * A super admin has no company, so every screen here — the counters, the
   * package list, the employee list — would either be empty or show the whole
   * system. Neither is what this dashboard is for, so it says so plainly
   * rather than rendering something misleading.
   *
   * This is presentation, not protection: Laravel would happily serve a super
   * admin these endpoints, and the admin panel is where they should ask.
   */
  if (session.user.role === 'super_admin') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-[var(--radius-base)] border border-border-subtle bg-surface p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-foreground">
            هذه اللوحة مخصّصة لحسابات الشركات
          </h1>
          <p className="mb-6 text-sm text-muted">
            دخلتَ بحساب مشرف عام، وهو لا ينتمي إلى شركة بعينها. استخدم لوحة
            التحكم العامة لإدارة النظام.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <SessionProvider session={session}>
      <CompanyShell>{children}</CompanyShell>
    </SessionProvider>
  );
}
