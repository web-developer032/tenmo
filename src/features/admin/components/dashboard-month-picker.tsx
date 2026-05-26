'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/**
 * 12-month dropdown shown next to the Dashboard's `Export report`
 * button. Selecting a month re-keys the page via `?month=YYYY-MM`
 * (server picks up the value to fetch the relevant snapshot).
 *
 * `months` is built on the server (so the labels match the user's
 * locale at request time) and passed in.
 */

export type DashboardMonth = {
  value: string;
  label: string;
};

export function DashboardMonthPicker({
  months,
  current,
}: {
  months: DashboardMonth[];
  current: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(params.toString());
    if (event.target.value) {
      next.set('month', event.target.value);
    } else {
      next.delete('month');
    }
    const qs = next.toString();
    router.push(`/admin${qs ? `?${qs}` : ''}`);
  };

  return (
    <select
      aria-label="Dashboard month"
      defaultValue={current}
      onChange={onChange}
      className="h-9 rounded-button border border-border-soft bg-white px-2.5 text-[12.5px] font-medium text-ink focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
    >
      {months.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
