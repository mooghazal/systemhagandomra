import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { authService } from '@hagamra/shared/services';
import { employeeSession, renderScreen } from '@hagamra/shared/test/harness';

import { ProfileView } from './ProfileView';

vi.mock('@hagamra/shared/services', () => ({
  authService: { changePassword: vi.fn() },
}));

const auth = vi.mocked(authService);

/**
 * The profile screen, which is read-only apart from one thing: the password.
 *
 * That exception is the point. Everything else about an account belongs to
 * whoever is responsible for it; a password belongs to the person who knows
 * it, and they must be able to change it without finding anyone.
 */
describe('ProfileView', () => {
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    current: string,
    next: string,
    confirmation = next,
  ) => {
    await user.type(screen.getByLabelText(/كلمة المرور الحالية/), current);
    await user.type(screen.getByLabelText(/كلمة المرور الجديدة/), next);
    await user.type(screen.getByLabelText(/تأكيد كلمة المرور/), confirmation);
  };

  it('shows the account details', () => {
    renderScreen(<ProfileView />);

    expect(screen.getByText('user@example.test')).toBeTruthy();
    expect(screen.getAllByText('المستخدم').length).toBeGreaterThan(0);
  });

  it('tells an employee with no permissions that they have none', () => {
    renderScreen(<ProfileView />, employeeSession([]));

    expect(screen.getByText(/لا توجد صلاحيات ممنوحة/)).toBeTruthy();
  });

  it('says that hiding a button is not what decides access', () => {
    // The screen states its own limits, because somebody reading a permission
    // list will otherwise assume it is the thing enforcing them.
    renderScreen(<ProfileView />);

    expect(screen.getByText(/كل طلب يُفحص من جديد في الخادم/)).toBeTruthy();
  });

  // -- Changing the password -----------------------------------------------

  it('changes the password', async () => {
    auth.changePassword.mockResolvedValue(undefined);

    const user = userEvent.setup();

    renderScreen(<ProfileView />);
    await fill(user, 'the-old-one-7', 'a-brand-new-one-9');
    await user.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }));

    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith('the-old-one-7', 'a-brand-new-one-9'));
  });

  it('refuses to submit when the confirmation does not match', async () => {
    const user = userEvent.setup();

    renderScreen(<ProfileView />);
    await fill(user, 'the-old-one-7', 'a-brand-new-one-9', 'a-brand-new-one-8');

    expect(screen.getByText('الكلمتان غير متطابقتين.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }));

    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('asks for the current password even though the person is signed in', () => {
    /*
     * A valid session is not proof of who is at the keyboard. Without this
     * field, anyone who found an open tab could lock its owner out of their
     * own account permanently.
     */
    renderScreen(<ProfileView />);

    expect(screen.getByLabelText(/كلمة المرور الحالية/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'تغيير كلمة المرور' }).hasAttribute('disabled'))
      .toBe(true);
  });

  it('shows the backend wording when the change is refused', async () => {
    auth.changePassword.mockRejectedValue(new Error('كلمة المرور الحالية غير صحيحة.'));

    const user = userEvent.setup();

    renderScreen(<ProfileView />);
    await fill(user, 'wrong-one-1', 'a-brand-new-one-9');
    await user.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }));

    const message = await screen.findByText('كلمة المرور الحالية غير صحيحة.');

    expect(message.getAttribute('role')).toBe('alert');
  });

  it('keeps what was typed when the change is refused', async () => {
    auth.changePassword.mockRejectedValue(new Error('خطأ'));

    const user = userEvent.setup();

    renderScreen(<ProfileView />);
    await fill(user, 'wrong-one-1', 'a-brand-new-one-9');
    await user.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }));

    await screen.findByText('خطأ');

    // Retyping three masked fields to correct one of them is a punishment,
    // not a safeguard.
    expect((screen.getByLabelText(/كلمة المرور الجديدة/) as HTMLInputElement).value)
      .toBe('a-brand-new-one-9');
  });

  it('warns that other sessions end', () => {
    renderScreen(<ProfileView />);

    expect(screen.getByText(/بينهي كل الجلسات المفتوحة/)).toBeTruthy();
  });
});
