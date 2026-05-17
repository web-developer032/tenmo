import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KIND_RULES } from '@/core/constants/notifications';
import { NotificationPreferences } from '@/core/schemas/notification';
import {
  groupKinds,
  mergePreferences,
  parseNotificationPreferences,
  resolveChannels,
} from '@/core/utils/notification-rules';

const defaults = (): NotificationPreferences => NotificationPreferences.parse({});

describe('notification-rules/parseNotificationPreferences', () => {
  it('returns canonical defaults for null/undefined/empty input', () => {
    expect(parseNotificationPreferences(null)).toEqual(defaults());
    expect(parseNotificationPreferences(undefined)).toEqual(defaults());
    expect(parseNotificationPreferences({})).toEqual(defaults());
  });

  it('lifts the legacy flat shape into channels', () => {
    const parsed = parseNotificationPreferences({ email: false, in_app: true, sms: true });
    expect(parsed.channels).toEqual({ email: false, in_app: true });
    expect(parsed.categories).toEqual({});
  });

  it('passes through the canonical shape unchanged (after Zod parse)', () => {
    const raw = {
      channels: { email: true, in_app: false },
      categories: {
        compliance_due: { email: false },
      },
    };
    const parsed = parseNotificationPreferences(raw);
    expect(parsed.channels).toEqual({ email: true, in_app: false });
    expect(parsed.categories.compliance_due?.email).toBe(false);
  });

  it('falls back to defaults when the shape is unparseable', () => {
    expect(parseNotificationPreferences({ channels: 'wrong' })).toEqual(defaults());
  });
});

describe('notification-rules/resolveChannels', () => {
  it('uses kind defaults when the user has no preference', () => {
    const prefs = defaults();
    const decision = resolveChannels(prefs, 'rent_paid');
    expect(decision).toEqual({ email: false, in_app: true });
  });

  it('forces email on for critical kinds even if the user disabled it', () => {
    const prefs = parseNotificationPreferences({
      channels: { email: false, in_app: true },
      categories: { compliance_overdue: { email: false } },
    });
    const decision = resolveChannels(prefs, 'compliance_overdue');
    expect(decision.email).toBe(true);
    expect(NOTIFICATION_KIND_RULES.compliance_overdue.critical).toBe(true);
  });

  it('respects per-kind override above the global toggle for non-critical kinds', () => {
    const prefs = parseNotificationPreferences({
      channels: { email: true, in_app: true },
      categories: { rent_paid: { email: true } },
    });
    expect(resolveChannels(prefs, 'rent_paid').email).toBe(true);
  });

  it('treats global email=false as a kill-switch for non-critical kinds', () => {
    const prefs = parseNotificationPreferences({ channels: { email: false, in_app: true } });
    expect(resolveChannels(prefs, 'ticket_message').email).toBe(false);
  });

  it('keeps in-app on by default; per-kind override wins', () => {
    const prefs = parseNotificationPreferences({
      categories: { ticket_message: { in_app: false } },
    });
    expect(resolveChannels(prefs, 'ticket_message').in_app).toBe(false);
  });
});

describe('notification-rules/mergePreferences', () => {
  it('shallow-merges channels', () => {
    const a = NotificationPreferences.parse({ channels: { email: true, in_app: true } });
    const merged = mergePreferences(a, { channels: { email: false } });
    expect(merged.channels).toEqual({ email: false, in_app: true });
  });

  it('deep-merges per-kind toggles', () => {
    const a = NotificationPreferences.parse({
      categories: { rent_paid: { email: true, in_app: true } },
    });
    const merged = mergePreferences(a, {
      categories: { rent_paid: { email: false } },
    });
    expect(merged.categories.rent_paid).toEqual({ email: false, in_app: true });
  });

  it('keeps unrelated categories intact', () => {
    const a = NotificationPreferences.parse({
      categories: { rent_paid: { email: false }, ticket_message: { in_app: false } },
    });
    const merged = mergePreferences(a, { categories: { rent_paid: { in_app: false } } });
    expect(merged.categories.rent_paid).toEqual({ email: false, in_app: false });
    expect(merged.categories.ticket_message).toEqual({ in_app: false });
  });
});

describe('notification-rules/groupKinds', () => {
  it('partitions kinds into the documented groups', () => {
    const groups = groupKinds();
    expect(groups.compliance?.length ?? 0).toBeGreaterThan(0);
    expect(groups.rent?.length ?? 0).toBeGreaterThan(0);
    expect(groups.tickets?.length ?? 0).toBeGreaterThan(0);
    const allCount = Object.values(groups).reduce((acc, g) => acc + g.length, 0);
    expect(allCount).toBe(Object.keys(NOTIFICATION_KIND_RULES).length);
  });
});
