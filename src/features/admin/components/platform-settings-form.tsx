'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlatformSettings } from '@/features/admin/server';

type Props = {
  initial: PlatformSettings;
  canEdit: boolean;
};

type FormState = Pick<
  PlatformSettings,
  | 'starter_plan_pence'
  | 'pro_plan_pence'
  | 'growth_plan_pence'
  | 'trial_days'
  | 'starter_property_limit'
  | 'pro_property_limit'
  | 'email_from_name'
  | 'email_from_address'
  | 'support_email'
  | 'compliance_alert_gas_days'
  | 'compliance_alert_eicr_days'
  | 'compliance_alert_hmo_days'
  | 'compliance_alert_epc_days'
  | 'compliance_alert_r2r_days'
  | 'compliance_alert_deposit_days'
  | 'assumed_cac_pence'
>;

/**
 * Single form that owns all editable platform settings. Wraps the
 * three configurable cards (pricing, email, compliance thresholds);
 * the Integrations card is server-rendered separately because it's
 * read-only.
 */
export function PlatformSettingsForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    starter_plan_pence: initial.starter_plan_pence,
    pro_plan_pence: initial.pro_plan_pence,
    growth_plan_pence: initial.growth_plan_pence,
    trial_days: initial.trial_days,
    starter_property_limit: initial.starter_property_limit,
    pro_property_limit: initial.pro_property_limit,
    email_from_name: initial.email_from_name,
    email_from_address: initial.email_from_address,
    support_email: initial.support_email,
    compliance_alert_gas_days: initial.compliance_alert_gas_days,
    compliance_alert_eicr_days: initial.compliance_alert_eicr_days,
    compliance_alert_hmo_days: initial.compliance_alert_hmo_days,
    compliance_alert_epc_days: initial.compliance_alert_epc_days,
    compliance_alert_r2r_days: initial.compliance_alert_r2r_days,
    compliance_alert_deposit_days: initial.compliance_alert_deposit_days,
    assumed_cac_pence: initial.assumed_cac_pence,
  });
  const [testEmailPending, setTestEmailPending] = useState(false);
  const sendTestEmail = () => {
    setTestEmailPending(true);
    fetch('/api/admin/settings/send-test-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => null)) as {
          data?: { provider?: string; to?: string };
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          toast.error(j?.error?.message ?? 'Could not send test email');
          return;
        }
        toast.success(`Test email queued via ${j?.data?.provider ?? 'mail'} to ${j?.data?.to}`);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Could not send test email');
      })
      .finally(() => setTestEmailPending(false));
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not save');
          return;
        }
        toast.success('Settings saved');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      }
    });
  };

  const disabled = !canEdit || pending;

  return (
    <form onSubmit={submit} className="space-y-5 lg:space-y-6">
      <ResponsiveGrid preset="cards-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan pricing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              id="starter"
              label="Starter (£/mo)"
              valuePence={form.starter_plan_pence}
              onChange={(v) => setField('starter_plan_pence', v)}
              disabled={disabled}
            />
            <MoneyField
              id="pro"
              label="Pro (£/mo)"
              valuePence={form.pro_plan_pence}
              onChange={(v) => setField('pro_plan_pence', v)}
              disabled={disabled}
            />
            <MoneyField
              id="growth"
              label="Growth (£/mo)"
              valuePence={form.growth_plan_pence}
              onChange={(v) => setField('growth_plan_pence', v)}
              disabled={disabled}
            />
            <NumField
              id="trial"
              label="Trial days"
              value={form.trial_days}
              min={0}
              max={90}
              onChange={(v) => setField('trial_days', v)}
              disabled={disabled}
            />
            <NumField
              id="starter-cap"
              label="Starter property cap"
              value={form.starter_property_limit}
              min={1}
              onChange={(v) => setField('starter_property_limit', v)}
              disabled={disabled}
            />
            <NumField
              id="pro-cap"
              label="Pro property cap"
              value={form.pro_property_limit}
              min={1}
              onChange={(v) => setField('pro_property_limit', v)}
              disabled={disabled}
            />
            <MoneyField
              id="cac"
              label="Assumed CAC (£)"
              valuePence={form.assumed_cac_pence}
              onChange={(v) => setField('assumed_cac_pence', v)}
              disabled={disabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="from-name">From name</Label>
              <Input
                id="from-name"
                value={form.email_from_name}
                onChange={(e) => setField('email_from_name', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from-email">From address</Label>
              <Input
                id="from-email"
                type="email"
                value={form.email_from_address}
                onChange={(e) => setField('email_from_address', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-email">Support inbox</Label>
              <Input
                id="support-email"
                type="email"
                value={form.support_email}
                onChange={(e) => setField('support_email', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canEdit || testEmailPending}
                onClick={sendTestEmail}
              >
                {testEmailPending ? 'Sending…' : 'Send test email'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </ResponsiveGrid>

      <Card>
        <CardHeader>
          <CardTitle>Compliance alert thresholds (days before expiry)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumField
            id="gas"
            label="Gas safety"
            value={form.compliance_alert_gas_days}
            min={0}
            max={365}
            onChange={(v) => setField('compliance_alert_gas_days', v)}
            disabled={disabled}
          />
          <NumField
            id="eicr"
            label="EICR"
            value={form.compliance_alert_eicr_days}
            min={0}
            max={365}
            onChange={(v) => setField('compliance_alert_eicr_days', v)}
            disabled={disabled}
          />
          <NumField
            id="hmo"
            label="HMO licence"
            value={form.compliance_alert_hmo_days}
            min={0}
            max={365}
            onChange={(v) => setField('compliance_alert_hmo_days', v)}
            disabled={disabled}
          />
          <NumField
            id="epc"
            label="EPC"
            value={form.compliance_alert_epc_days}
            min={0}
            max={365}
            onChange={(v) => setField('compliance_alert_epc_days', v)}
            disabled={disabled}
          />
          <NumField
            id="r2r"
            label="Right-to-Rent"
            value={form.compliance_alert_r2r_days}
            min={0}
            max={365}
            onChange={(v) => setField('compliance_alert_r2r_days', v)}
            disabled={disabled}
          />
          <NumField
            id="deposit"
            label="Deposit protection"
            value={form.compliance_alert_deposit_days}
            min={0}
            max={365}
            onChange={(v) => setField('compliance_alert_deposit_days', v)}
            disabled={disabled}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled}>
          {pending ? 'Saving…' : canEdit ? 'Save all changes' : 'Read-only'}
        </Button>
      </div>
    </form>
  );
}

function MoneyField({
  id,
  label,
  valuePence,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  valuePence: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step="0.01"
        min={0}
        value={(valuePence / 100).toString()}
        onChange={(e) => onChange(Math.round(parseFloat(e.target.value || '0') * 100))}
        disabled={disabled}
      />
    </div>
  );
}

function NumField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value.toString()}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
        disabled={disabled}
      />
    </div>
  );
}
