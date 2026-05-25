/**
 * Admin design-system primitives.
 *
 * Most of these primitives are now generic enough to live in the global
 * design system at `components/ds/*` (so landlord pages can reuse them).
 * This barrel re-exports them under the historical `Admin*` aliases so
 * existing admin pages keep working without churn.
 *
 * Admin-specific shells (`AdminFeatureBar`, `AdminPlatformHealth`) still
 * live in this folder because they're not used outside `/admin/*`.
 */

import {
  Banner,
  type BannerProps,
  type BannerTone,
  BarChart,
  type BarChartDatum,
  type BarChartProps,
  FilterRow,
  type FilterRowProps,
  TabBar,
  type TabBarProps,
  type TabItem,
} from '@/components/ds';

// Aliased re-exports — admin code still imports `AdminBanner` etc.
export const AdminBanner = Banner;
export const AdminBarChart = BarChart;
export const AdminFilterRow = FilterRow;
export const AdminTabBar = TabBar;

export type AdminBannerProps = BannerProps;
export type AdminBannerTone = BannerTone;
export type AdminBarChartDatum = BarChartDatum;
export type AdminBarChartProps = BarChartProps;
export type AdminFilterRowProps = FilterRowProps;
export type AdminTabBarProps = TabBarProps;
export type AdminTabItem = TabItem;

export type { AdminFeatureBarProps } from './admin-feature-bar';
export { AdminFeatureBar } from './admin-feature-bar';
export type {
  AdminPlatformHealthProps,
  HealthService,
  HealthStatus,
} from './admin-platform-health';
export { AdminPlatformHealth } from './admin-platform-health';
