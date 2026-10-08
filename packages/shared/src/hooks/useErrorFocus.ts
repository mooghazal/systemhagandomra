'use client';

import { useEffect } from 'react';

/**
 * Brings the first rejected field into view after a save is refused.
 *
 * These forms are longer than the dialog is tall, so they scroll, and the save
 * button sits at the bottom. The field the backend refused is usually far
 * above it — the company on a hotel, the name on a package. Without this,
 * pressing Save looks exactly like pressing a dead button: the dialog stays
 * open, nothing moves, and the sentence explaining why is off-screen.
 *
 * It anchors on the error text rather than on `aria-invalid`, because every
 * field renders the message through <Field> while only some pass the invalid
 * flag down to their control.
 */
export function useErrorFocus(errors: Record<string, string>) {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;

    const dialog = document.querySelector('dialog[open]');
    const alert = dialog?.querySelector<HTMLElement>('[role="alert"]');

    if (!alert) return;

    alert.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // <Field> names the message `${id}-error`, so the control it belongs to is
    // one lookup away. Focusing it means a keyboard user lands on the thing
    // they have to correct, not merely near it.
    document
      .getElementById(alert.id.replace(/-error$/, ''))
      ?.focus({ preventScroll: true });
  }, [errors]);
}
