import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { FeatureSelector, PACKAGE_FEATURES } from './FeatureSelector';

/**
 * The feature picker (spec §22, §32).
 *
 * What matters here is that it never forces a choice: nothing is selected by
 * default, an empty list is a valid answer, and a label the system has never
 * seen is accepted — because the backend stores features as free JSON
 * precisely so the list can grow without a migration.
 */

/** A host that holds the value, so the control is exercised as it really runs. */
function Harness({ initial = [] as string[] }) {
  const [value, setValue] = useState<string[]>(initial);

  return (
    <>
      <FeatureSelector suggestions={PACKAGE_FEATURES} value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}

const value = () => JSON.parse(screen.getByTestId('value').textContent ?? '[]') as string[];

describe('FeatureSelector', () => {
  it('starts with nothing selected', () => {
    render(<Harness />);

    expect(value()).toEqual([]);
    expect(screen.getByText('لم تُحدَّد أي مزايا')).toBeTruthy();
  });

  it('toggles a suggestion on and off', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'فندق' }));
    expect(value()).toEqual(['فندق']);

    await user.click(screen.getByRole('button', { name: 'فندق' }));
    expect(value()).toEqual([]);
  });

  it('reports selection state to assistive technology', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const hotel = screen.getByRole('button', { name: 'فندق' });

    // A colour change alone would tell a screen-reader user nothing.
    expect(hotel.getAttribute('aria-pressed')).toBe('false');

    await user.click(hotel);

    expect(screen.getByRole('button', { name: 'فندق' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('accepts a feature that is not in the suggested list', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // The backend accepts any label; the UI must not be stricter than it.
    await user.type(screen.getByLabelText('إضافة ميزة غير مدرجة'), 'خدمة كبار الشخصيات');
    await user.click(screen.getByRole('button', { name: 'إضافة' }));

    expect(value()).toEqual(['خدمة كبار الشخصيات']);
  });

  it('adds a custom feature on Enter without submitting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    function InForm() {
      const [features, setFeatures] = useState<string[]>([]);

      return (
        <form onSubmit={onSubmit}>
          <FeatureSelector suggestions={PACKAGE_FEATURES} value={features} onChange={setFeatures} />
          <output data-testid="value">{JSON.stringify(features)}</output>
        </form>
      );
    }

    render(<InForm />);

    await user.type(screen.getByLabelText('إضافة ميزة غير مدرجة'), 'زيارة الطائف{Enter}');

    expect(value()).toEqual(['زيارة الطائف']);
    // Enter inside a nested input must not save the whole package.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores an empty or duplicate custom entry', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['فندق']} />);

    const input = screen.getByLabelText('إضافة ميزة غير مدرجة');

    await user.type(input, '   {Enter}');
    expect(value()).toEqual(['فندق']);

    await user.type(input, 'فندق{Enter}');
    expect(value()).toEqual(['فندق']);
  });

  it('shows and can remove a stored feature the suggestions do not include', async () => {
    const user = userEvent.setup();

    // Something an earlier user typed, or that came from the agent.
    render(<Harness initial={['ميزة قديمة']} />);

    expect(screen.getByText('ميزة قديمة')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'إزالة ميزة قديمة' }));

    expect(value()).toEqual([]);
  });

  it('counts the selection out loud', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'فندق' }));
    await user.click(screen.getByRole('button', { name: 'مواصلات' }));

    expect(screen.getByText('2 ميزة مختارة')).toBeTruthy();
  });

  it('can be disabled wholesale', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <FeatureSelector
        suggestions={PACKAGE_FEATURES}
        value={[]}
        onChange={onChange}
        disabled
      />,
    );

    await user.click(screen.getByRole('button', { name: 'فندق' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
