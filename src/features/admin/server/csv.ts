import 'server-only';

/**
 * Tiny CSV helper used by the admin Export buttons.
 *
 * Designed for synchronous in-memory generation — the admin lists are
 * paginated and the export routes cap at 5000 rows. If we ever need
 * exports larger than that we'll swap this for a streaming
 * `ReadableStream` writer, but for now keeping it dead simple beats
 * worrying about backpressure.
 */

export type CsvColumn<T> = {
  header: string;
  /** Cell value. Strings, numbers, nulls and dates all OK. */
  value: (row: T) => string | number | null | undefined | boolean | Date;
};

const RFC_4180_REQUIRES_QUOTING = /[",\r\n]/;

function escapeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let s: string;
  if (raw instanceof Date) {
    s = raw.toISOString();
  } else if (typeof raw === 'boolean') {
    s = raw ? 'true' : 'false';
  } else {
    s = String(raw);
  }
  if (RFC_4180_REQUIRES_QUOTING.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCell(c.header)).join(','));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(','));
  }
  // Trailing newline matches Excel/Sheets expectations.
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Wrap rows in a `Response` ready for return from a Route Handler.
 * The default filename uses the report name + today's date so saved
 * downloads sort nicely in Finder/Explorer.
 */
export function csvResponse<T>(
  reportName: string,
  rows: T[],
  columns: CsvColumn<T>[],
  opts: { filename?: string } = {},
): Response {
  const body = rowsToCsv(rows, columns);
  const filename = opts.filename ?? `${reportName}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

/** Cap exports so a stray `?per_page=999999` doesn't OOM the worker. */
export const MAX_EXPORT_ROWS = 5_000;
