/**
 * Key-value row — paired label + value used throughout detail/summary pages
 * (admin org detail, admin user detail, account profile, etc.).
 *
 * Renders "—" when the value is `null` / `undefined` / empty string, so
 * callers can pass DB columns directly without defensive `?? '—'` at every
 * site.
 */
export type KVProps = {
  label: string;
  value: string | number | null | undefined;
};

export function KV({ label, value }: KVProps) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{display}</span>
    </div>
  );
}
