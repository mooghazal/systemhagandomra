<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Turns a query into a CSV download.
 *
 * Streamed rather than built in memory. An export is the one request that
 * deliberately ignores pagination, so it is also the one that will eventually
 * meet a company with ten thousand packages — and a version that assembled the
 * whole file first would fail exactly then, in production, for the largest
 * customer.
 */
final class CsvExport
{
    /**
     * How many rows to pull from the database at a time.
     *
     * `cursor()` would hold one row at a time but keeps the result set open
     * for the whole response; chunking releases it between batches.
     */
    private const CHUNK = 500;

    /**
     * @param  Builder<covariant Model>  $query
     * @param  array<string, string>  $columns  heading => attribute
     * @param  callable(Model): array<int, scalar|null>|null  $row
     */
    public static function stream(
        Builder $query,
        array $columns,
        string $filename,
        ?callable $row = null,
    ): StreamedResponse {
        $headings = array_keys($columns);
        $attributes = array_values($columns);

        return response()->streamDownload(
            function () use ($query, $headings, $attributes, $row): void {
                $handle = fopen('php://output', 'wb');

                /*
                 * A byte-order mark, which is not decoration.
                 *
                 * Excel on Windows reads a CSV as the system codepage unless
                 * the file starts with one — so without this, every Arabic
                 * name in the export opens as mojibake, and the person who
                 * opened it has no way to tell whether the data or the file
                 * is broken.
                 */
                fwrite($handle, "\xEF\xBB\xBF");

                fputcsv($handle, $headings);

                $query->chunk(self::CHUNK, function ($records) use ($handle, $attributes, $row): void {
                    foreach ($records as $record) {
                        fputcsv($handle, $row
                            ? $row($record)
                            : array_map(
                                fn (string $attribute) => self::scalar($record->getAttribute($attribute)),
                                $attributes,
                            ));
                    }

                    flush();
                });

                fclose($handle);
            },
            $filename,
            [
                'Content-Type' => 'text/csv; charset=UTF-8',
                // The browser is downloading this, not rendering it.
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'no-store',
            ],
        );
    }

    /**
     * Flattens a value into something a cell can hold.
     */
    private static function scalar(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'نعم' : 'لا';
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        if (is_array($value)) {
            return implode(' | ', $value);
        }

        return (string) $value;
    }
}
