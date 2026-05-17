/**
 * Profile preferences — curated option lists for locale, timezone and theme.
 *
 * Single source of truth for the dropdowns on `/account` and any future
 * onboarding step. We deliberately keep these short for MVP rather than
 * shipping the full IANA tz list (1 000+ entries) — UK users overwhelmingly
 * sit in `Europe/London`, and a power-user will rarely change the value
 * via the UI. Add to the lists when a real customer asks for it.
 */

export type LocaleOption = { value: string; label: string };
export type TimezoneOption = { value: string; label: string };
export type ThemeOption = { value: 'light' | 'dark' | 'system'; label: string };

/** UK-first locale picker. Driven by `Intl.DateTimeFormat` keys. */
export const LOCALE_OPTIONS: LocaleOption[] = [
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-IE', label: 'English (Ireland)' },
];

/**
 * IANA timezone picker — covers the everyday UK / Ireland use cases plus
 * a UTC anchor for ops accounts. Add Europe/Belfast etc. only if a real
 * user reports drift; the default `Europe/London` already follows BST.
 */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'Europe/London', label: 'Europe/London (UK)' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin (Ireland)' },
  { value: 'UTC', label: 'UTC' },
];

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Type-narrow set of valid locale strings the form accepts. */
export const LOCALE_VALUES = LOCALE_OPTIONS.map((o) => o.value);
/** Type-narrow set of valid timezone strings the form accepts. */
export const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((o) => o.value);
