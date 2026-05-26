import { Calendar, CheckCircle2, Home as HomeIcon } from 'lucide-react';
import { formatMoney } from '@/core/utils/money';
import { cn } from '@/lib/cn';
import type { RentHero, TenantPrimaryTenancy } from '../types';

/**
 * Tenant rent banner — the gradient hero from the HMOeez tenant home design.
 *
 * Built specifically for the tenant Home page (vs the generic DS `RentHero`)
 * because the design needs both a 3-stat strip *and* a tenancy-progress
 * column at the top-right. We keep the look in sync with the DS hero by
 * sharing the same `from-forest-600 to-forest-500` gradient and tone tints.
 */

type Props = {
  hero: RentHero;
  tenancy: TenantPrimaryTenancy;
  monthLabel: string;
};

const STATE_TINT: Record<RentHero['state'], { label: string; chip: string }> = {
  paid: { label: 'Paid on time', chip: 'bg-white/20 text-white' },
  due: { label: 'Due soon', chip: 'bg-amber text-white' },
  overdue: { label: 'Overdue', chip: 'bg-alert text-white' },
  upcoming: { label: 'Upcoming', chip: 'bg-white/20 text-white' },
};

export function TenantRentHero({ hero, tenancy, monthLabel }: Props) {
  const state = STATE_TINT[hero.state];
  const pct = tenancy.progressPct;
  return (
    <div className="relative overflow-hidden rounded-modal bg-gradient-to-br from-forest-600 to-forest-500 p-5 text-white shadow-(--shadow-card) lg:p-7">
      <div aria-hidden className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
            <HomeIcon className="h-3.5 w-3.5" />
            Your rent this month · {monthLabel}
          </div>
          <div className="mt-3 font-sans text-4xl font-extrabold leading-none tracking-tight sm:text-5xl lg:text-6xl">
            {formatMoney(hero.amountPence).replace(/\.00$/, '')}
          </div>
          <div className="mt-2 text-[13px] text-white/85">
            {hero.state === 'paid' && hero.paidOn
              ? `Paid ${shortDate(hero.paidOn)} · ${hero.rentMethodLabel}`
              : `Due ${hero.dueDate ? shortDate(hero.dueDate) : 'this month'} · ${hero.rentMethodLabel}`}
          </div>
          <span
            className={cn(
              'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wide',
              state.chip,
            )}
          >
            {hero.state === 'paid' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Calendar className="h-3.5 w-3.5" />
            )}
            {state.label}
          </span>
        </div>

        {pct != null ? (
          <div className="flex flex-col items-start lg:items-end lg:text-right">
            <div className="text-[11px] uppercase tracking-wider text-mint/90">
              Tenancy progress
            </div>
            <div className="mt-1 font-sans text-[22px] font-bold leading-none">{pct}%</div>
            <div className="text-[11px] text-white/70">
              {tenancy.monthsElapsed} of {tenancy.totalMonths} months
            </div>
            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex w-32 justify-between text-[10px] uppercase tracking-wider text-white/60">
              <span>{tenancy.startDate ? shortMonthYear(tenancy.startDate) : '—'}</span>
              <span>{tenancy.endDate ? shortMonthYear(tenancy.endDate) : 'Open'}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
        <Stat
          value={tenancy.totalMonths != null ? String(tenancy.totalMonths) : 'Periodic'}
          label="Months total"
        />
        <Stat
          value={formatMoney(tenancy.depositPence).replace(/\.00$/, '')}
          label={
            tenancy.depositScheme
              ? `Deposit (${tenancy.depositScheme.toUpperCase()} protected)`
              : 'Deposit'
          }
        />
        <Stat value={tenancy.endDate ? shortDate(tenancy.endDate) : '—'} label="Tenancy end date" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-sans text-[18px] font-extrabold leading-tight text-white">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortMonthYear(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { month: 'short', year: 'numeric' });
}
