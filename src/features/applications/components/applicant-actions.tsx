'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Per-application action buttons.
 *
 * "Accept" reveals a small inline form with the rent / deposit / scheme /
 * start-date the resulting tenancy needs. "Reject" reveals a one-line
 * decline-reason input.
 */
export function ApplicantActions({
  applicationId,
  orgSlug,
  defaultRentPence,
  defaultRentFrequency,
}: {
  applicationId: string;
  orgSlug: string;
  defaultRentPence: number | null;
  defaultRentFrequency: 'monthly' | 'weekly';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'idle' | 'accept' | 'reject'>('idle');
  const [startDate, setStartDate] = useState('');
  const [rentPounds, setRentPounds] = useState(
    defaultRentPence ? (defaultRentPence / 100).toString() : '',
  );
  const [depositPounds, setDepositPounds] = useState('');
  const [scheme, setScheme] = useState('');
  const [reason, setReason] = useState('');

  async function call(path: string, body: object) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Action failed');
      router.refresh();
      setMode('idle');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'accept') {
    return (
      <form
        className="grid grid-cols-1 gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!startDate) {
            toast.error('Pick a start date');
            return;
          }
          const rentPence = Math.round(Number(rentPounds || '0') * 100);
          if (!rentPence) {
            toast.error('Enter the rent in pounds');
            return;
          }
          await call(`/api/landlord/${orgSlug}/applications/${applicationId}/accept`, {
            start_date: startDate,
            rent_pence: rentPence,
            rent_frequency: defaultRentFrequency,
            deposit_pence: depositPounds ? Math.round(Number(depositPounds) * 100) : 0,
            deposit_scheme: scheme || null,
          });
          toast.success('Accepted — tenant invite sent.');
        }}
      >
        <div className="space-y-1">
          <Label htmlFor={`accept-start-${applicationId}`}>Start date</Label>
          <Input
            id={`accept-start-${applicationId}`}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`accept-rent-${applicationId}`}>
            Rent (£/{defaultRentFrequency === 'weekly' ? 'wk' : 'mo'})
          </Label>
          <Input
            id={`accept-rent-${applicationId}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={rentPounds}
            onChange={(e) => setRentPounds(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`accept-deposit-${applicationId}`}>Deposit (£)</Label>
          <Input
            id={`accept-deposit-${applicationId}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={depositPounds}
            onChange={(e) => setDepositPounds(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`accept-scheme-${applicationId}`}>Deposit scheme</Label>
          <select
            id={`accept-scheme-${applicationId}`}
            value={scheme}
            onChange={(e) => setScheme(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">None / cash deposit</option>
            <option value="dps">DPS</option>
            <option value="mydeposits">mydeposits</option>
            <option value="tds">TDS</option>
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Accepting…' : 'Confirm accept + send invite'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode('idle')} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (mode === 'reject') {
    return (
      <form
        className="space-y-2 rounded-md border bg-muted/40 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await call(`/api/landlord/${orgSlug}/applications/${applicationId}/reject`, {
            decline_reason: reason.trim() || 'Not selected for this room.',
          });
          toast.success('Application rejected');
        }}
      >
        <Label htmlFor={`reject-reason-${applicationId}`}>Reason (shown to applicant)</Label>
        <Textarea
          id={`reject-reason-${applicationId}`}
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional. Defaults to 'Not selected for this room.'"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" disabled={busy}>
            {busy ? 'Rejecting…' : 'Confirm reject'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode('idle')} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => setMode('accept')}>
        Accept + start tenancy
      </Button>
      <Button type="button" variant="outline" onClick={() => setMode('reject')}>
        Reject
      </Button>
    </div>
  );
}
