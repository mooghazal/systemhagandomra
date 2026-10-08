'use client';

import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@hagamra/shared/lib/cn';
import { Button } from '@hagamra/shared/components/ui/Button';

/**
 * The one image control in the panel (spec §31), used for company logos,
 * packages, hotels and buses alike.
 *
 * It reports three things to the form: a new `file` to send, whether the
 * existing image should be `removed`, and nothing at all when neither applies.
 * That three-way answer is what lets the backend tell "leave it alone" apart
 * from "delete it" — the same distinction the rest of the form keeps between
 * an omitted field and an explicit null.
 *
 * The size and type checks here are for quick feedback only. Laravel validates
 * the file again, against its real content rather than its name, and that is
 * the check that counts (§21).
 */

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export interface ImageSelection {
  file: File | null;
  removed: boolean;
}

export function ImageUploader({
  label = 'الصورة',
  currentUrl,
  onChange,
  disabled = false,
  error,
}: {
  label?: string;
  /** The stored image, if the record already has one. */
  currentUrl?: string | null;
  onChange: (selection: ImageSelection) => void;
  disabled?: boolean;
  error?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // An object URL is a live handle to memory; letting them accumulate on every
  // re-pick is a leak that only shows up after a long editing session.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview ?? (removed ? null : currentUrl ?? null);

  function accept(file: File | undefined) {
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setLocalError('الصيغ المقبولة: JPEG أو PNG أو WebP فقط.');
      return;
    }

    if (file.size > MAX_BYTES) {
      setLocalError('حجم الصورة يتجاوز ٥ ميجابايت.');
      return;
    }

    setLocalError(null);
    if (preview) URL.revokeObjectURL(preview);

    setPreview(URL.createObjectURL(file));
    setRemoved(false);
    onChange({ file, removed: false });
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);

    setPreview(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';

    // Only an image that exists on the server needs removing; discarding a
    // pick that was never sent is not a deletion.
    const wasStored = Boolean(currentUrl);
    setRemoved(wasStored);
    onChange({ file: null, removed: wasStored });
  }

  const message = localError ?? error;

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">
        {label}
        <span className="text-muted text-xs font-normal ms-2">(اختياري)</span>
      </span>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          'rounded-[var(--radius-base)] border-2 border-dashed p-4 transition-colors',
          dragging ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-muted',
          message && 'border-danger',
          disabled && 'opacity-60',
        )}
      >
        {shown ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shown}
              alt="معاينة الصورة"
              className="size-24 shrink-0 rounded-md border border-border-subtle object-cover"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" aria-hidden="true" />
                استبدال
              </Button>

              <Button variant="ghost" size="sm" disabled={disabled} onClick={clear}>
                <Trash2 className="size-4" aria-hidden="true" />
                إزالة
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 py-6 text-center',
              disabled && 'cursor-not-allowed',
            )}
          >
            <ImagePlus className="size-7 text-muted" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">
              اسحب صورة هنا أو اضغط للاختيار
            </span>
            <span className="text-xs text-muted">JPEG أو PNG أو WebP — حتى ٥ ميجابايت</span>
          </label>
        )}

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          disabled={disabled}
          onChange={(event) => accept(event.target.files?.[0])}
          className="sr-only"
        />
      </div>

      {message && (
        <p role="alert" className="text-xs text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
