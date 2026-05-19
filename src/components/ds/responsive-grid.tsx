import type * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Tenantly / HMOeez responsive grid presets.
 *
 * Centralises the grid reflow patterns used by every page so we never
 * hand-roll `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` strings inline.
 * Per the user rule, this avoids duplication when 20+ pages need the same
 * KPI / dash / form layout.
 *
 * Presets follow the mock's `:root` + page structure:
 *
 *  kpi      — `kpi-row` 4-up. Goes 1 → 2 → 4 across base/sm/lg.
 *  kpi-5    — Financials 5-up KPI row. 1 → 2 → 3 → 5 across base/sm/lg/xl.
 *  dash-2   — `dash-grid`. Left column ~1.4fr, right ~1fr at lg+.
 *  dash-3   — `dash-grid-3`. Three equal columns at lg+.
 *  form-2   — `grid-2`. Two-up form fields at lg+, stacked below.
 *  cards-2  — Plain two-up card row at lg+.
 *  cards-3  — Plain three-up card row at lg+.
 *  listings — Public listings card grid: 1 → 2 → 3 across base/sm/xl.
 */

type Preset = 'kpi' | 'kpi-5' | 'dash-2' | 'dash-3' | 'form-2' | 'cards-2' | 'cards-3' | 'listings';

const PRESETS: Record<Preset, string> = {
  kpi: 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4',
  'kpi-5': 'grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:gap-4',
  'dash-2': 'grid gap-4 grid-cols-1 lg:grid-cols-[1.4fr_1fr] lg:gap-5',
  'dash-3': 'grid gap-4 grid-cols-1 lg:grid-cols-3 lg:gap-5',
  'form-2': 'grid gap-4 grid-cols-1 lg:grid-cols-2',
  'cards-2': 'grid gap-4 grid-cols-1 lg:grid-cols-2 lg:gap-5',
  'cards-3': 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:gap-5',
  listings: 'grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
};

export type ResponsiveGridProps = React.ComponentProps<'div'> & {
  preset: Preset;
};

export function ResponsiveGrid({ preset, className, ...props }: ResponsiveGridProps) {
  return <div className={cn(PRESETS[preset], className)} {...props} />;
}
