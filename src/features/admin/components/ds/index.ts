/**
 * Admin design-system primitives.
 *
 * These build on the global DS (`components/ds/*`) with admin-specific
 * concerns: dashboard banners, MRR bar charts, feature-adoption progress
 * bars, platform-health rows, pill tabs and filter rows.
 *
 * Pages should import from this barrel, not the individual files.
 */

export type { AdminBannerProps, AdminBannerTone } from './admin-banner';
export { AdminBanner } from './admin-banner';
export type { AdminBarChartDatum, AdminBarChartProps } from './admin-bar-chart';
export { AdminBarChart } from './admin-bar-chart';
export type { AdminFeatureBarProps } from './admin-feature-bar';
export { AdminFeatureBar } from './admin-feature-bar';
export type { AdminFilterRowProps } from './admin-filter-row';
export { AdminFilterRow } from './admin-filter-row';
export type {
  AdminPlatformHealthProps,
  HealthService,
  HealthStatus,
} from './admin-platform-health';
export { AdminPlatformHealth } from './admin-platform-health';
export type { AdminTabBarProps, AdminTabItem } from './admin-tab-bar';
export { AdminTabBar } from './admin-tab-bar';
