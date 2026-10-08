'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Opens a create dialog when the URL asks for it, which is how the dashboard's
 * quick actions work: `/packages?new=1` lands on the list with the form
 * already up.
 *
 * The flag is read during render rather than copied into state by an effect.
 * An effect would open the dialog in a second pass — React calls that a
 * cascading render — and would paint the bare list for one frame first.
 *
 * `allowed` is the caller's own permission check. A link can be typed by hand,
 * so a screen that may not create anything must not open the form; Laravel
 * would refuse the submission either way, but offering it is a dead end.
 */
export function useCreateFromUrl(
  allowed: boolean,
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const params = useSearchParams();
  const wanted = allowed && params.get('new') === '1';

  const [creating, setCreating] = useState(wanted);
  const [seen, setSeen] = useState(wanted);

  // The URL can change while this screen stays mounted — a second visit to the
  // same list from the dashboard. Adjusting state during render is React's own
  // answer to that, and it settles before the browser paints.
  if (wanted !== seen) {
    setSeen(wanted);

    if (wanted) setCreating(true);
  }

  return [creating, setCreating];
}
