'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type RecordDepositTenancyOption = {
  id: string;
  label: string;
  defaultAmountPence: number;
};

export type RecordDepositModalProps = {
  slug: string;
  tenancies: RecordDepositTenancyOption[];
  triggerLabel?: string;
};

/**
 * "Record deposit" modal — writes to
 * `POST /api/landlord/[slug]/tenancies/[id]/deposit`. The user picks
 * a tenancy, scheme, reference, and protection date; we keep the
 * `prescribed_information_sent_at` toggle inline so the page's KPI
 * for prescribed info reflects the choice immediately.
 */
export function RecordDepositModal({
  slug,
  tenancies,
  triggerLabel = 'Record deposit',
}: RecordDepositModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [tenancyId, setTenancyId] = useState<string>(tenancies[0]?.id ?? '');
  const [amount, setAmount] = useState(
    tenancies[0] ? (tenancies[0].defaultAmountPence / 100).toFixed(2) : '',
  );
  const [scheme, setScheme] = useState<'dps' | 'mydeposits' | 'tds'>('dps');
  const [reference, setReference] = useState('');
  const [protectedAt, setProtectedAt] = useState(new Date().toISOString().slice(0, 10));
  const [prescribedSent, setPrescribedSent] = useState(true);

  const onTenancyChange = (id: string) => {
    setTenancyId(id);
    const t = tenancies.find((x) => x.id === id);
    if (t) setAmount((t.defaultAmountPence / 100).toFixed(2));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pence = Math.round(Number.parseFloat(amount) * 100);
    if (!tenancyId || !Number.isFinite(pence) || pence < 0) {
      toast.error('Choose a tenancy and a valid amount.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/landlord/${slug}/tenancies/${tenancyId}/deposit`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deposit_pence: pence,
          deposit_scheme: scheme,
          deposit_reference: reference.trim() || null,
          deposit_protected_at: new Date(`${protectedAt}T00:00:00Z`).toISOString(),
          prescribed_information_sent_at: prescribedSent ? new Date().toISOString() : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Failed to record deposit');
      }
      toast.success('Deposit recorded');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record deposit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record deposit</DialogTitle>
          <DialogDescription>
            Log the scheme, reference and protection date. We&apos;ll track the prescribed-info
            deadline automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="dep-tenancy">Tenancy</Label>
            <select
              id="dep-tenancy"
              value={tenancyId}
              onChange={(e) => onTenancyChange(e.target.value)}
              required
              disabled={busy}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {tenancies.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dep-amount">Amount (GBP)</Label>
              <Input
                id="dep-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dep-scheme">Scheme</Label>
              <select
                id="dep-scheme"
                value={scheme}
                onChange={(e) => setScheme(e.target.value as 'dps' | 'mydeposits' | 'tds')}
                disabled={busy}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="dps">DPS</option>
                <option value="mydeposits">mydeposits</option>
                <option value="tds">TDS</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="dep-ref">Reference</Label>
              <Input
                id="dep-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="DPS-2025-11201"
                maxLength={120}
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="dep-protected">Protected on</Label>
              <Input
                id="dep-protected"
                type="date"
                value={protectedAt}
                onChange={(e) => setProtectedAt(e.target.value)}
                required
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={prescribedSent}
              onChange={(e) => setPrescribedSent(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 rounded border-input text-forest-600 focus:ring-forest-600/30"
            />
            Prescribed information sent to tenant
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save deposit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
