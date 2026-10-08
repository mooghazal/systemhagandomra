'use client';

import { useState } from 'react';

import { Button } from '@hagamra/shared/components/ui/Button';
import { Field, Input } from '@hagamra/shared/components/ui/Field';
import { useToast } from '@hagamra/shared/components/ui/Toast';
import { authService } from '@hagamra/shared/services';

/**
 * Changing your own password, available to every role.
 *
 * Until this existed the only way to change a password was for somebody more
 * senior to do it — an employee had to ask their owner, an owner a super
 * admin. The person with the most urgent reason to act was the one who could
 * not.
 *
 * The current password is asked for even though the person is already signed
 * in. That is not a formality: a valid session is not proof of who is sitting
 * at the keyboard, and it is the only thing here that tells the account holder
 * apart from whoever is currently holding their session.
 */
export function ChangePasswordForm() {
  const toast = useToast();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checked here only to save a round trip and to say so before the field is
  // cleared; the backend refuses a mismatch regardless.
  const mismatch = confirmation !== '' && next !== confirmation;

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (mismatch) return;

    setBusy(true);
    setError(null);

    try {
      await authService.changePassword(current, next);

      // Cleared on success only. After a failure the two new-password fields
      // are still what the person meant to type, and making them type them
      // again teaches nothing.
      setCurrent('');
      setNext('');
      setConfirmation('');

      toast.success('تم تغيير كلمة المرور. باقي الجلسات اتقفلت.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذّر تغيير كلمة المرور.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius-base)] border border-danger-border bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="كلمة المرور الحالية" required>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          )}
        </Field>

        <Field label="كلمة المرور الجديدة" required hint="10 أحرف على الأقل، فيها حروف وأرقام">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="تأكيد كلمة المرور"
          required
          error={mismatch ? 'الكلمتان غير متطابقتين.' : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          )}
        </Field>
      </div>

      <Button
        type="submit"
        loading={busy}
        disabled={current === '' || next === '' || confirmation === '' || mismatch}
      >
        تغيير كلمة المرور
      </Button>
    </form>
  );
}
