'use client';

import { useState } from 'react';

import { cn } from '@hagamra/shared/lib/cn';
import { formatNumber } from '@hagamra/shared/utils/format';

/**
 * A horizontal bar chart for "how many of each".
 *
 * Horizontal rather than vertical because the categories are Arabic phrases of
 * varying length — as column labels they would have to be rotated or truncated,
 * and both are worse than turning the chart on its side.
 *
 * One series, so one hue: the bars are told apart by their labels, not their
 * colour, and painting each a different one would imply a distinction that is
 * not in the data. The colour is the packages accent, which passes contrast
 * against both the light and the dark surface.
 *
 * Every value is also printed. A chart whose numbers can only be estimated
 * from bar lengths is decoration, and the table underneath means a screen
 * reader gets the same data rather than a picture of it.
 */

export interface Slice {
  label: string;
  total: number;
}

export function BreakdownBars({
  data,
  caption,
  emptyMessage = 'لا توجد بيانات لعرضها.',
}: {
  data: Slice[];
  /** Describes the figures for anyone not seeing the bars. */
  caption: string;
  emptyMessage?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  // Scaled against the largest bar rather than the total: the question is
  // "which types do we carry most of", not "what share of the catalogue".
  const largest = Math.max(...data.map((slice) => slice.total), 1);
  const sum = data.reduce((running, slice) => running + slice.total, 0);

  return (
    <figure className="m-0">
      <ul className="flex flex-col gap-3">
        {data.map((slice) => {
          const share = Math.round((slice.total / sum) * 100);
          const active = hovered === slice.label;

          return (
            <li
              key={slice.label}
              onMouseEnter={() => setHovered(slice.label)}
              onMouseLeave={() => setHovered(null)}
              className="group/bar"
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-foreground">{slice.label}</span>

                {/* The value in a text token, never the series colour. */}
                <span className="tabular shrink-0 text-sm font-semibold text-foreground">
                  {formatNumber(slice.total)}
                  <span className="ms-1.5 text-xs font-normal text-muted">{share}%</span>
                </span>
              </div>

              {/* The track is the recessive one-step-off-surface gray. */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={cn(
                    'h-full rounded-e-[4px] bg-[var(--accent-packages)] transition-[width,opacity] duration-300',
                    active ? 'opacity-100' : 'opacity-90',
                  )}
                  // The bar is the data; the width is the only thing that
                  // encodes it.
                  style={{ width: `${Math.max((slice.total / largest) * 100, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/*
        The same numbers as a table, for a screen reader and for anyone who
        wants to read rather than estimate. Visually hidden, not absent — a
        chart that exists only as geometry is not available to everyone.
      */}
      <figcaption className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">النوع</th>
              <th scope="col">العدد</th>
            </tr>
          </thead>
          <tbody>
            {data.map((slice) => (
              <tr key={slice.label}>
                <th scope="row">{slice.label}</th>
                <td>{slice.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
