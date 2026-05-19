'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Responsive data-table from the mock's `.data-table` pattern.
 *
 *  - lg+: renders a proper HTML <table> with uppercase headers and a
 *         hover-foam row treatment.
 *  - < lg: each row collapses to a clickable Card that shows a primary
 *         line, an optional secondary line, and optional right-aligned
 *         meta content. The full cell content is hidden on mobile to keep
 *         density manageable.
 *
 * Define rows once via `columns`. The `mobile` hint on each column picks
 * which column becomes the card's primary/secondary/meta slot — anything
 * with no hint is desktop-only. This keeps page-level code from having to
 * duplicate desktop + mobile markup (per the user's "no duplication" rule).
 */

export type ColumnAlign = 'left' | 'right' | 'center';
export type MobileSlot = 'primary' | 'secondary' | 'meta';

export type Column<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  align?: ColumnAlign;
  /**
   * When set, this column also appears on the mobile card view in the
   * matching slot. Columns without `mobile` are hidden on mobile.
   */
  mobile?: MobileSlot;
  /** Column width (CSS value). Optional. */
  width?: string;
  /** Hide on very narrow desktops (e.g. ≤ md). Defaults to false. */
  hideMd?: boolean;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Optional href factory — turns each row into a navigable card / link. */
  rowHref?: (row: T) => string;
  /** Optional click handler when not using href. */
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  /** Optional caption rendered above the desktop table (and stripped on mobile). */
  caption?: React.ReactNode;
  className?: string;
};

const ALIGN: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function findSlot<T>(columns: Column<T>[], slot: MobileSlot): Column<T> | undefined {
  return columns.find((c) => c.mobile === slot);
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  emptyState,
  caption,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-soft bg-white p-8 text-center',
          className,
        )}
      >
        {emptyState ?? <p className="text-[13px] text-ink-light">No records to show yet.</p>}
      </div>
    );
  }

  const primaryCol = findSlot(columns, 'primary');
  const secondaryCol = findSlot(columns, 'secondary');
  const metaCol = findSlot(columns, 'meta');

  return (
    <>
      {/* Desktop: full table */}
      <div
        className={cn(
          'hidden overflow-hidden rounded-card border border-border-soft bg-white lg:block',
          className,
        )}
      >
        <div className="overflow-x-auto">
          {caption ? (
            <div className="border-b border-border-soft px-5 py-3 text-[12px] text-ink-light">
              {caption}
            </div>
          ) : null}
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border-soft bg-bg-page text-[11px] font-bold uppercase tracking-wider text-ink-light">
                {columns.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'px-4 py-2.5 font-bold',
                      ALIGN[col.align ?? 'left'],
                      col.hideMd && 'hidden xl:table-cell',
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const cells = columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      'px-4 py-3 align-middle text-ink',
                      ALIGN[col.align ?? 'left'],
                      col.hideMd && 'hidden xl:table-cell',
                    )}
                  >
                    {col.cell(row, i)}
                  </td>
                ));
                if (rowHref) {
                  return (
                    <tr
                      key={rowKey(row, i)}
                      className="border-b border-border-soft transition-colors last:border-b-0 hover:bg-foam/60"
                    >
                      {cells.map((cell, idx) => (
                        <td key={columns[idx]?.id ?? idx} className="p-0">
                          <Link
                            href={rowHref(row)}
                            className={cn(
                              'block px-4 py-3 align-middle text-ink hover:text-forest-700',
                              ALIGN[columns[idx]?.align ?? 'left'],
                              columns[idx]?.hideMd && 'hidden xl:block',
                            )}
                          >
                            {columns[idx]?.cell(row, i)}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  );
                }
                return (
                  <tr
                    key={rowKey(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-border-soft transition-colors last:border-b-0',
                      onRowClick && 'cursor-pointer hover:bg-foam/60',
                    )}
                  >
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile / tablet: card stack */}
      <div className={cn('flex flex-col gap-2 lg:hidden', className)}>
        {rows.map((row, i) => {
          const primary = primaryCol?.cell(row, i);
          const secondary = secondaryCol?.cell(row, i);
          const meta = metaCol?.cell(row, i);
          const inner = (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {primary ? (
                  <div className="font-sans text-[14px] font-semibold leading-tight text-ink">
                    {primary}
                  </div>
                ) : null}
                {secondary ? (
                  <div className="mt-1 text-[12.5px] text-ink-light">{secondary}</div>
                ) : null}
              </div>
              {meta ? (
                <div className="shrink-0 text-right text-[12.5px] font-semibold text-ink">
                  {meta}
                </div>
              ) : null}
              {rowHref ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-light" /> : null}
            </div>
          );
          if (rowHref) {
            return (
              <Link
                key={rowKey(row, i)}
                href={rowHref(row)}
                className="rounded-card border border-border-soft bg-white p-3.5 transition-colors hover:bg-foam/60"
              >
                {inner}
              </Link>
            );
          }
          if (onRowClick) {
            return (
              <button
                key={rowKey(row, i)}
                type="button"
                onClick={() => onRowClick(row)}
                className="cursor-pointer rounded-card border border-border-soft bg-white p-3.5 text-left transition-colors hover:bg-foam/60"
              >
                {inner}
              </button>
            );
          }
          return (
            <div
              key={rowKey(row, i)}
              className="rounded-card border border-border-soft bg-white p-3.5"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </>
  );
}
