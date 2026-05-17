'use client';

import { Loader2, Save } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  NOTIFICATION_GROUP_LABEL,
  type NotificationGroup,
  type NotificationKind,
} from '@/core/constants/notifications';
import type { NotificationPreferences } from '@/core/schemas/notification';
import { groupKinds, resolveChannels } from '@/core/utils/notification-rules';
import { updateNotificationPreferencesApi } from '../api/client';

/**
 * Preferences form for `/account/settings/notifications`.
 *
 * Layout:
 *   1. Global section — kill-switches for email + in-app across the
 *      entire account.
 *   2. Per-category sections — one card per `NotificationGroup`, each row
 *      a notification kind with email/in-app toggles. Critical kinds
 *      lock the email toggle on (matches doc:
 *      docs/07-flows/12-notifications.md#categories).
 *
 * Saves via PATCH `/api/notifications/preferences`. The submit button is
 * disabled until the form is dirty so we never write a no-op patch.
 */

export type NotificationPreferencesFormProps = {
  initial: NotificationPreferences;
};

type DraftPrefs = {
  channels: { email: boolean; in_app: boolean };
  categories: Record<string, { email?: boolean; in_app?: boolean }>;
};

function toDraft(p: NotificationPreferences): DraftPrefs {
  return {
    channels: {
      email: p.channels?.email ?? true,
      in_app: p.channels?.in_app ?? true,
    },
    categories: { ...p.categories },
  };
}

function isEqual(a: DraftPrefs, b: DraftPrefs): boolean {
  if (a.channels.email !== b.channels.email) return false;
  if (a.channels.in_app !== b.channels.in_app) return false;
  const aKeys = Object.keys(a.categories);
  const bKeys = Object.keys(b.categories);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const aa = a.categories[k] ?? {};
    const bb = b.categories[k] ?? {};
    if (aa.email !== bb.email || aa.in_app !== bb.in_app) return false;
  }
  return true;
}

export function NotificationPreferencesForm({ initial }: NotificationPreferencesFormProps) {
  const [baseline, setBaseline] = React.useState<DraftPrefs>(() => toDraft(initial));
  const [draft, setDraft] = React.useState<DraftPrefs>(() => toDraft(initial));
  const [saving, setSaving] = React.useState(false);

  const dirty = !isEqual(baseline, draft);

  const setGlobal = (channel: 'email' | 'in_app', value: boolean) => {
    setDraft((prev) => ({ ...prev, channels: { ...prev.channels, [channel]: value } }));
  };

  const setCategory = (kind: NotificationKind, channel: 'email' | 'in_app', value: boolean) => {
    setDraft((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [kind]: { ...(prev.categories[kind] ?? {}), [channel]: value },
      },
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const next = await updateNotificationPreferencesApi({
        channels: draft.channels,
        categories: draft.categories as NotificationPreferences['categories'],
      });
      const fresh = toDraft(next);
      setBaseline(fresh);
      setDraft(fresh);
      toast.success('Preferences saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => setDraft(baseline);

  // Build the section list once, ordered as in NOTIFICATION_GROUP_LABEL.
  const grouped = React.useMemo(() => groupKinds(), []);
  const groupOrder: NotificationGroup[] = [
    'compliance',
    'rent',
    'tickets',
    'tenancies',
    'messages',
    'documents',
    'billing',
    'system',
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Email"
            description="Master switch. Critical alerts (overdue compliance, failed rent, billing) are always emailed."
            channel="email"
            checked={draft.channels.email}
            onChange={(v) => setGlobal('email', v)}
          />
          <ToggleRow
            label="In-app"
            description="Bell icon, /notifications page and realtime updates."
            channel="in_app"
            checked={draft.channels.in_app}
            onChange={(v) => setGlobal('in_app', v)}
          />
        </CardContent>
      </Card>

      {groupOrder.map((group) => {
        const rules = grouped[group];
        if (!rules || rules.length === 0) return null;
        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-base">{NOTIFICATION_GROUP_LABEL[group]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rules.map((rule) => {
                const draftToggles = draft.categories[rule.kind] ?? {};
                const resolved = resolveChannels(
                  {
                    channels: draft.channels,
                    categories: draft.categories as NotificationPreferences['categories'],
                  },
                  rule.kind,
                );
                const emailChecked = draftToggles.email ?? resolved.email;
                const inAppChecked = draftToggles.in_app ?? resolved.in_app;
                return (
                  <div
                    key={rule.kind}
                    className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">{rule.label}</p>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                      {rule.critical ? (
                        <p className="text-[11px] font-medium uppercase tracking-wide text-warning">
                          Critical · email always on
                        </p>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs sm:w-44">
                      <ChannelToggle
                        label="Email"
                        checked={emailChecked}
                        disabled={rule.critical}
                        onChange={(v) => setCategory(rule.kind, 'email', v)}
                      />
                      <ChannelToggle
                        label="In-app"
                        checked={inAppChecked}
                        onChange={(v) => setCategory(rule.kind, 'in_app', v)}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onReset} disabled={!dirty || saving}>
          Reset
        </Button>
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save preferences
        </Button>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  channel,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  channel: 'email' | 'in_app';
}) {
  const id = `pref-global-${channel}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}

function ChannelToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}
