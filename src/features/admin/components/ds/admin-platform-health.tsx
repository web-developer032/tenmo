import { cn } from '@/lib/cn';

/**
 * Platform health list from the HMOeez mock — one row per third-party
 * service with a coloured dot + status text. Renders inside an existing
 * Card; bring your own header.
 */

export type HealthStatus = 'operational' | 'degraded' | 'outage' | 'unknown';

const DOT: Record<HealthStatus, string> = {
  operational: 'bg-forest-500',
  degraded: 'bg-amber',
  outage: 'bg-alert',
  unknown: 'bg-ink-light',
};

const LABEL: Record<HealthStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  unknown: 'Unknown',
};

const TEXT: Record<HealthStatus, string> = {
  operational: 'text-forest-500',
  degraded: 'text-amber',
  outage: 'text-alert',
  unknown: 'text-ink-light',
};

export type HealthService = {
  name: string;
  status: HealthStatus;
  /** Optional override of the default label. */
  detail?: string;
};

export type AdminPlatformHealthProps = {
  services: HealthService[];
  className?: string;
};

export function AdminPlatformHealth({ services, className }: AdminPlatformHealthProps) {
  if (services.length === 0) {
    return (
      <p className={cn('text-[13px] text-ink-light', className)}>No services configured yet.</p>
    );
  }
  return (
    <ul className={cn('flex flex-col', className)}>
      {services.map((s) => (
        <li
          key={s.name}
          className="flex items-center gap-3 border-b border-border-soft py-2.5 last:border-b-0"
        >
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[s.status])} aria-hidden />
          <span className="flex-1 text-[13px] text-ink">{s.name}</span>
          <span className={cn('text-[12px] font-semibold', TEXT[s.status])}>
            {s.detail ?? LABEL[s.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
