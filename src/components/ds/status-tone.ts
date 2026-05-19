/**
 * Tenantly / HMOeez status tones.
 *
 * Centralised palette of "tones" so every status badge, dot, panel border
 * and helper text across the app emits the same shade for the same idea
 * (forest = ok / paid / active, amber = warn / due soon, alert = bad /
 * overdue / failed, blue = informational / in-progress, neutral / sand =
 * dormant / closed / refunded). Feature-level `status-display.ts` modules
 * declare which `ToneName` each business state maps to; consumers read the
 * matching `ToneClasses` here. Replaces all the ad-hoc
 * `bg-emerald-500/10 text-emerald-700 …` strings that used to live next to
 * the business logic.
 */
export type ToneName = 'forest' | 'amber' | 'alert' | 'blue' | 'neutral' | 'sand';

export interface ToneClasses {
  /** Small inline pill / badge (background + foreground). */
  chip: string;
  /** Soft surface for panels, alerts, summary cards. */
  soft: string;
  /** 1 px border colour, matched to the tone. */
  border: string;
  /** Foreground-only text colour for inline labels. */
  text: string;
  /** 6 px status dot. */
  dot: string;
  /** Ring colour for focus rings + accent strips. */
  ring: string;
}

export const TONE: Record<ToneName, ToneClasses> = {
  forest: {
    chip: 'bg-foam text-forest-700',
    soft: 'bg-forest-50',
    border: 'border-forest-200',
    text: 'text-forest-600',
    dot: 'bg-forest-500',
    ring: 'ring-forest-500/30',
  },
  amber: {
    chip: 'bg-amber-bg text-amber',
    soft: 'bg-amber-bg',
    border: 'border-amber/30',
    text: 'text-amber',
    dot: 'bg-amber',
    ring: 'ring-amber/30',
  },
  alert: {
    chip: 'bg-alert-bg text-alert',
    soft: 'bg-alert-bg',
    border: 'border-alert/30',
    text: 'text-alert',
    dot: 'bg-alert',
    ring: 'ring-alert/30',
  },
  blue: {
    chip: 'bg-blue-bg text-blue',
    soft: 'bg-blue-bg',
    border: 'border-blue/30',
    text: 'text-blue',
    dot: 'bg-blue',
    ring: 'ring-blue/30',
  },
  neutral: {
    chip: 'bg-sand text-ink-mid',
    soft: 'bg-sand',
    border: 'border-border-soft',
    text: 'text-ink-mid',
    dot: 'bg-ink-light',
    ring: 'ring-ink-light/30',
  },
  sand: {
    chip: 'bg-sand text-ink',
    soft: 'bg-sand',
    border: 'border-border-soft',
    text: 'text-ink',
    dot: 'bg-ink-light',
    ring: 'ring-ink-light/30',
  },
};

export function tone(name: ToneName): ToneClasses {
  return TONE[name];
}

/**
 * Convenience helper for the very common case of "I just want the badge
 * pill classes for this tone".
 */
export function toneChip(name: ToneName): string {
  return TONE[name].chip;
}
