import { describe, expect, it } from 'vitest';

import {
  formatDistance,
  formatPrice,
  formatRating,
  orderPermissionGroups,
  toFormData,
} from './format';

/**
 * toFormData carries the rule the whole system turns on: the difference
 * between a field left alone, a field cleared, and a field set to a falsy
 * value. Get it wrong and "remove the price" silently becomes "set it to
 * zero", which no amount of backend validation can catch — both are valid.
 */
describe('toFormData', () => {
  const entries = (form: FormData) => [...form.entries()].map(([k, v]) => [k, v]);

  it('omits undefined so an untouched field stays untouched', () => {
    const form = toFormData({ name: 'باقة', price: undefined });

    expect(entries(form)).toEqual([['name', 'باقة']]);
    expect(form.has('price')).toBe(false);
  });

  it('sends null as empty, which the backend reads as "clear this"', () => {
    const form = toFormData({ price: null });

    expect(form.get('price')).toBe('');
  });

  it('keeps zero rather than dropping it as falsy', () => {
    const form = toFormData({ price: 0 });

    // A package priced at zero is priced. It is not an unpriced package.
    expect(form.get('price')).toBe('0');
    expect(form.get('price')).not.toBe('');
  });

  it('keeps false rather than dropping it as falsy', () => {
    const form = toFormData({ is_active: false });

    expect(form.get('is_active')).toBe('0');
  });

  it('sends true as 1', () => {
    expect(toFormData({ is_active: true }).get('is_active')).toBe('1');
  });

  it('sends a populated array as repeated keys', () => {
    const form = toFormData({ features: ['فندق', 'مواصلات'] });

    expect(form.getAll('features[]')).toEqual(['فندق', 'مواصلات']);
  });

  it('sends an empty array as a bare empty value, not an array holding ""', () => {
    const form = toFormData({ features: [] });

    // `features[]=''` would arrive as [''] and store a phantom feature;
    // `features=''` becomes null and clears the list.
    expect(form.getAll('features[]')).toEqual([]);
    expect(form.get('features')).toBe('');
  });

  it('passes a File through untouched', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const form = toFormData({ image: file });

    expect(form.get('image')).toBe(file);
  });

  it('distinguishes all three states in one payload', () => {
    const form = toFormData({
      name: 'باقة',          // changed
      price: null,            // cleared
      days: undefined,        // untouched
      is_active: false,       // set to false
      features: [],           // emptied
    });

    expect(form.get('name')).toBe('باقة');
    expect(form.get('price')).toBe('');
    expect(form.has('days')).toBe(false);
    expect(form.get('is_active')).toBe('0');
    expect(form.get('features')).toBe('');
  });
});

describe('formatPrice', () => {
  it('returns null for an absent price so the UI can show a dash', () => {
    expect(formatPrice(null, 'SAR')).toBeNull();
    expect(formatPrice(undefined, 'SAR')).toBeNull();
  });

  it('formats zero as a real price', () => {
    expect(formatPrice(0, 'SAR')).toBe('0 SAR');
  });

  it('uses Western digits beside the Latin currency code', () => {
    const formatted = formatPrice(35000, 'SAR');

    expect(formatted).toContain('35,000');
    expect(formatted).toContain('SAR');
    // Arabic-Indic numerals would collide with the Latin code next to them.
    expect(formatted).not.toMatch(/[٠-٩]/);
  });

  it('omits the currency when none is recorded', () => {
    expect(formatPrice(12000, null)).toBe('12,000');
  });
});

describe('formatDistance', () => {
  it('returns null when no distance applies', () => {
    // A Makkah hotel has no distance to Masjid an-Nabawi.
    expect(formatDistance(null)).toBeNull();
  });

  it('shows metres below a kilometre and kilometres above', () => {
    expect(formatDistance(850)).toBe('850 م');
    expect(formatDistance(2500)).toBe('2.5 كم');
  });

  it('treats zero as a distance, not as missing', () => {
    expect(formatDistance(0)).toBe('0 م');
  });
});

describe('formatRating', () => {
  it('returns null when unrated', () => {
    expect(formatRating(null)).toBeNull();
  });

  it('renders filled and empty stars to five', () => {
    expect(formatRating(4)).toBe('★★★★☆');
    expect(formatRating(5)).toBe('★★★★★');
  });
});

describe('orderPermissionGroups', () => {
  it('orders groups the way a company thinks about them', () => {
    // The backend returns them alphabetically by English key, which is
    // meaningless once the labels are Arabic.
    const fromBackend = { buses: 1, employees: 2, hotels: 3, packages: 4 };

    expect(orderPermissionGroups(fromBackend).map(([group]) => group)).toEqual([
      'packages',
      'hotels',
      'buses',
      'employees',
    ]);
  });

  it('keeps an unknown group rather than dropping it', () => {
    // A permission group added in Laravel must still appear here without a
    // frontend change — at the end, but present.
    const withNewGroup = { bookings: 0, packages: 1, buses: 2 };

    expect(orderPermissionGroups(withNewGroup).map(([group]) => group)).toEqual([
      'packages',
      'buses',
      'bookings',
    ]);
  });

  it('returns an empty list for no groups', () => {
    expect(orderPermissionGroups({})).toEqual([]);
  });
});
