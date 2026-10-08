'use client';

import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '@hagamra/shared/lib/cn';
import { Button } from '@hagamra/shared/components/ui/Button';

/**
 * Feature picking for packages, hotels and buses (spec §32).
 *
 * The suggestions are exactly that — suggestions. The backend stores features
 * as a free JSON array precisely so the list can grow without a migration, so
 * this control also accepts anything typed in. Pinning the UI to a fixed list
 * would put back the rigidity the schema was designed to avoid.
 *
 * Nothing is selected by default, and none of it is required: a package with
 * no features is a valid package (§22).
 */

export const PACKAGE_FEATURES = [
  'فندق',
  'مواصلات',
  'وجبات',
  'تأشيرة',
  'استقبال من المطار',
  'مرشد',
  'زيارات',
  'طيران',
];

export const HOTEL_FEATURES = [
  'واي فاي',
  'إفطار',
  'غداء',
  'عشاء',
  'تكييف',
  'مصعد',
  'موقف سيارات',
  'مواصلات',
  'خدمة الغرف',
  'استقبال',
  'قريب من الحرم',
  'قريب من المسجد النبوي',
];

export const BUS_FEATURES = [
  'تكييف',
  'واي فاي',
  'شحن USB',
  'مقاعد مريحة',
  'مقاعد قابلة للإمالة',
  'ترفيه',
  'مساحة للأمتعة',
  'دورة مياه',
  'تتبّع GPS',
  'مخصّص لذوي الاحتياجات',
];

export function FeatureSelector({
  label = 'المزايا',
  suggestions,
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  suggestions: string[];
  value: string[];
  onChange: (features: string[]) => void;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState('');
  const customInputId = useId();

  const toggle = (feature: string) => {
    onChange(
      value.includes(feature) ? value.filter((item) => item !== feature) : [...value, feature],
    );
  };

  const addCustom = () => {
    const entry = custom.trim();

    if (!entry || value.includes(entry)) {
      setCustom('');
      return;
    }

    onChange([...value, entry]);
    setCustom('');
  };

  // Anything chosen that is not in the suggested list — typed in here, or
  // added by someone else earlier — still has to be shown and removable.
  const extras = value.filter((feature) => !suggestions.includes(feature));

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        {label}
        <span className="text-muted text-xs font-normal ms-2">(اختر ما ينطبق فقط)</span>
      </legend>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((feature) => {
          const selected = value.includes(feature);

          return (
            <button
              key={feature}
              type="button"
              onClick={() => toggle(feature)}
              aria-pressed={selected}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                selected
                  ? 'border-primary bg-primary-soft font-medium text-primary'
                  : 'border-border-strong bg-surface text-muted-strong hover:border-primary/40 hover:bg-surface-muted',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {feature}
            </button>
          );
        })}

        {extras.map((feature) => (
          <span
            key={feature}
            className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary"
          >
            {feature}
            <button
              type="button"
              onClick={() => toggle(feature)}
              aria-label={`إزالة ${feature}`}
              className="rounded-full p-0.5 transition-opacity hover:opacity-70"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          id={customInputId}
          type="text"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the feature; it must not submit the surrounding form.
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder="إضافة ميزة أخرى…"
          // A placeholder is not a label: it disappears the moment someone
          // starts typing, and a screen reader may never announce it at all.
          // The visible label would be noise here, so it is hidden visually
          // and left in the accessibility tree.
          aria-label="إضافة ميزة غير مدرجة"
          className="h-9 flex-1 rounded-[var(--radius-base)] border bg-surface px-3 text-sm"
        />

        <Button variant="outline" size="sm" onClick={addCustom} disabled={!custom.trim()}>
          <Plus className="size-4" aria-hidden="true" />
          إضافة
        </Button>
      </div>

      <p className="text-xs text-muted" aria-live="polite">
        {value.length === 0 ? 'لم تُحدَّد أي مزايا' : `${value.length} ميزة مختارة`}
      </p>
    </fieldset>
  );
}
