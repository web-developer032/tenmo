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
import { EXPENSE_CATEGORY_VALUES, type ExpenseCategory } from '@/core/schemas/expense';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  repairs: 'Repairs',
  insurance: 'Insurance',
  mortgage: 'Mortgage',
  utilities: 'Utilities',
  agent_fees: 'Agent fees',
  compliance: 'Compliance',
  software: 'Software',
  travel: 'Travel',
  professional_fees: 'Professional fees',
  other: 'Other',
};

export type AddExpenseModalProps = {
  slug: string;
  properties: { id: string; name: string }[];
};

/**
 * "Add expense" dialog backed by `POST /api/landlord/[slug]/expenses`.
 *
 * Keeps the property list in JS state so the user can attach the
 * expense to a specific property (or leave it blank for portfolio-
 * wide costs like insurance). On success we toast + refresh the
 * router so the parent server page re-renders the totals.
 */
export function AddExpenseModal({ slug, properties }: AddExpenseModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [occurredOn, setOccurredOn] = useState(today);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('repairs');
  const [propertyId, setPropertyId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [mtdEligible, setMtdEligible] = useState(true);

  const reset = () => {
    setOccurredOn(today);
    setDescription('');
    setCategory('repairs');
    setPropertyId('');
    setAmount('');
    setMtdEligible(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pence = Math.round(Number.parseFloat(amount) * 100);
    if (!Number.isFinite(pence) || pence < 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/landlord/${slug}/expenses`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId || null,
          occurred_on: occurredOn,
          description: description.trim(),
          category,
          amount_pence: pence,
          mtd_eligible: mtdEligible,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Failed to add expense');
      }
      toast.success('Expense recorded');
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>
            Add a new line to your expense ledger. Flag it as MTD-eligible to include in your
            quarterly HMRC submission.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                required
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="exp-amount">Amount (GBP)</Label>
              <Input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="exp-desc">Description</Label>
            <Input
              id="exp-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Boiler repair — Mike's Plumbing"
              minLength={2}
              maxLength={500}
              required
              disabled={busy}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="exp-category">Category</Label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                disabled={busy}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {EXPENSE_CATEGORY_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="exp-property">Property (optional)</Label>
              <select
                id="exp-property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                disabled={busy}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={mtdEligible}
              onChange={(e) => setMtdEligible(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 rounded border-input text-forest-600 focus:ring-forest-600/30"
            />
            Include in MTD totals
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Add expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
