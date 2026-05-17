'use client';

import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BILL_ALLOCATION_METHOD_DESCRIPTION,
  BILL_ALLOCATION_METHOD_LABEL,
  BILL_ALLOCATION_METHOD_VALUES,
  BILL_TYPE_LABEL,
  BILL_TYPE_VALUES,
  type BillAllocationMethod,
  type BillType,
  SHARE_BASIS_POINTS_TOTAL,
} from '@/core/constants/bills';
import { CreateBillInput } from '@/core/schemas/bills';
import { BillsApiError, createBillApi } from '../api/client';

/**
 * Landlord "Add bill" form. Inline below the bills list on the
 * property detail page (no modal — fits the rest of the app's
 * inline-form pattern).
 *
 * Behaviour:
 *   - Total + period required.
 *   - Allocation method picker — shows description below.
 *   - When method='by_share', surfaces a per-room share editor
 *     (each row 0–100% with two decimals; live sum + balance
 *     warning).
 *   - When method='equal_per_room', tells the landlord we'll split
 *     between currently-occupied rooms automatically.
 *   - When method='included_in_rent' / 'landlord_pays', no
 *     allocation UI.
 */
export interface BillFormRoom {
  id: string;
  name: string;
}

export function BillForm({
  propertyId,
  rooms,
  onClose,
}: {
  propertyId: string;
  rooms: ReadonlyArray<BillFormRoom>;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = React.useState<BillType>('electricity');
  const [provider, setProvider] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [totalPounds, setTotalPounds] = React.useState('');
  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [method, setMethod] = React.useState<BillAllocationMethod>('equal_per_room');
  const [notes, setNotes] = React.useState('');
  const [shares, setShares] = React.useState<Record<string, string>>(() =>
    initialEqualShares(rooms),
  );
  const [pending, setPending] = React.useState(false);

  // Re-initialise the per-room share map whenever the room set
  // changes (and we're in the by_share method that needs it).
  // Using the React 19 "adjust state during render" pattern instead
  // of a useEffect — runs in the same render and avoids the
  // cascading-renders lint warning.
  const roomsKey = React.useMemo(
    () =>
      rooms
        .map((r) => r.id)
        .sort()
        .join(','),
    [rooms],
  );
  const [lastInitKey, setLastInitKey] = React.useState<string | null>(null);
  if (method === 'by_share' && lastInitKey !== roomsKey) {
    setLastInitKey(roomsKey);
    setShares(initialEqualShares(rooms));
  }

  const sharesSum = React.useMemo(() => {
    if (method !== 'by_share') return 100;
    return Object.values(shares).reduce((acc, raw) => acc + parsePercent(raw), 0);
  }, [method, shares]);
  const sharesBalanced = Math.round(sharesSum * 100) === 100 * 100;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const totalPence = Math.round(parseFloat(totalPounds || '0') * 100);
    const candidate = {
      property_id: propertyId,
      type,
      provider: provider.trim() || undefined,
      reference: reference.trim() || undefined,
      total_pence: totalPence,
      period_start: periodStart,
      period_end: periodEnd,
      allocation_method: method,
      notes: notes.trim() || undefined,
      shares:
        method === 'by_share'
          ? rooms.map((r) => ({
              room_id: r.id,
              share_basis_points: Math.round(parsePercent(shares[r.id] ?? '0') * 100),
            }))
          : undefined,
    };
    const parsed = CreateBillInput.safeParse(candidate);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Please fix the highlighted fields');
      return;
    }
    setPending(true);
    try {
      await createBillApi(parsed.data);
      toast.success('Bill added.');
      router.refresh();
      onClose?.();
    } catch (err) {
      const msg = err instanceof BillsApiError ? err.message : 'Could not save the bill.';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add bill</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="bill-type">Type</Label>
              <select
                id="bill-type"
                value={type}
                onChange={(e) => setType(e.target.value as BillType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {BILL_TYPE_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {BILL_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-total">Total (£)</Label>
              <Input
                id="bill-total"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={totalPounds}
                onChange={(e) => setTotalPounds(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-period-start">Period start</Label>
              <Input
                id="bill-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-period-end">Period end</Label>
              <Input
                id="bill-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-provider">Provider (optional)</Label>
              <Input
                id="bill-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. British Gas"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-reference">Reference (optional)</Label>
              <Input
                id="bill-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bill / account number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bill-method">Allocation</Label>
            <select
              id="bill-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as BillAllocationMethod)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {BILL_ALLOCATION_METHOD_VALUES.map((m) => (
                <option key={m} value={m}>
                  {BILL_ALLOCATION_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {BILL_ALLOCATION_METHOD_DESCRIPTION[method]}
            </p>
          </div>

          {method === 'by_share' && rooms.length > 0 ? (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label>Room shares (%)</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rooms.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm">{r.name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      inputMode="decimal"
                      value={shares[r.id] ?? '0'}
                      onChange={(e) => setShares((s) => ({ ...s, [r.id]: e.target.value }))}
                      className="w-24 text-right"
                    />
                  </div>
                ))}
              </div>
              <p
                className={`text-xs ${sharesBalanced ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}
              >
                Total: {sharesSum.toFixed(2)}%
                {sharesBalanced ? ' (balanced)' : ' — must equal 100%'}
              </p>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="bill-notes">Notes (optional)</Label>
            <Textarea
              id="bill-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any context to remember next time."
            />
          </div>

          <div className="flex justify-end gap-2">
            {onClose ? (
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" disabled={pending || (method === 'by_share' && !sharesBalanced)}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add bill
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const SHARE_PRECISION = SHARE_BASIS_POINTS_TOTAL / 100; // 100 = full percent

function parsePercent(raw: string): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return value;
}

function initialEqualShares(rooms: ReadonlyArray<BillFormRoom>): Record<string, string> {
  if (rooms.length === 0) return {};
  // Distribute 100% so the form starts balanced. Use share precision
  // (basis points / 100 = percent with 2 dp) and put the remainder
  // on the first room.
  const totalBp = SHARE_BASIS_POINTS_TOTAL;
  const baseBp = Math.floor(totalBp / rooms.length);
  const remainderBp = totalBp - baseBp * rooms.length;
  const out: Record<string, string> = {};
  rooms.forEach((r, idx) => {
    const bp = baseBp + (idx === 0 ? remainderBp : 0);
    out[r.id] = (bp / SHARE_PRECISION).toFixed(2);
  });
  return out;
}
