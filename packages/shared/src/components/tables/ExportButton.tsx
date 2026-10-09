'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@hagamra/shared/components/ui/Button';
import { useToast } from '@hagamra/shared/components/ui/Toast';

/**
 * Downloads the current listing as a CSV.
 *
 * It carries the filters and the sort the screen is using, so the file
 * matches what the person was looking at rather than everything that exists.
 *
 * The request goes through fetch rather than pointing a link at the endpoint,
 * for two reasons. A plain link cannot say anything when the server refuses —
 * the browser would navigate to a JSON error page. And the download has to go
 * through this app's proxy to pick up the session cookie, which means the
 * response arrives here as a body rather than as a navigation.
 */
export function ExportButton({
  resource,
  filters,
  disabled = false,
}: {
  /** The API path: packages, hotels, buses. */
  resource: string;
  /** The listing's current filters, sort included. */
  filters: Record<string, unknown>;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);

    try {
      const query = new URLSearchParams();

      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;

        query.set(key, String(value));
      }

      const response = await fetch(`/api/laravel/${resource}/export?${query}`, {
        headers: { Accept: 'text/csv' },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? 'ليست لديك صلاحية لتصدير هذه البيانات.'
            : 'تعذّر تصدير الملف. حاول مرة أخرى.',
        );
      }

      const blob = await response.blob();

      /*
       * The filename comes from the server's Content-Disposition, which is
       * where it belongs — it carries today's date and the Arabic resource
       * name, and duplicating that here would be two places to change it.
       */
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const name = match?.[1] ? decodeURIComponent(match[1]) : `${resource}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = name;
      link.click();

      // Without this the blob stays in memory for the life of the page.
      URL.revokeObjectURL(url);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'تعذّر تصدير الملف.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={download}
      loading={busy}
      disabled={disabled}
      title="تنزيل القائمة الحالية كملف Excel"
    >
      {!busy && <Download className="size-4" aria-hidden="true" />}
      تصدير
    </Button>
  );
}
