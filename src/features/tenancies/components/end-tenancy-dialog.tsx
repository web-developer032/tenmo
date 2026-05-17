'use client';

import { Loader2, StopCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { noticeDaysForEndReason, type TenancyEndReasonLike } from '@/core/utils/tenancy-rules';

const REASONS: { value: TenancyEndReasonLike; label: string }[] = [
  { value: 'tenant_notice', label: 'Tenant gave notice' },
  { value: 'mutual_break', label: 'Mutual break — both parties agree' },
  { value: 'rent_arrears', label: 'Rent arrears (8+ weeks)' },
  { value: 'antisocial_behaviour', label: 'Anti-social behaviour' },
  { value: 'breach_of_terms', label: 'Breach of tenancy terms' },
  { value: 'landlord_moving_in', label: 'Landlord moving in' },
  { value: 'sale_of_property', label: 'Sale of property' },
  { value: 'other', label: 'Other' },
];

/**
 * End-tenancy dialog. Encodes the Renters' Rights Bill notice floor for each
 * reason in the UI hint; the server independently enforces the same rule.
 */
export function EndTenancyDialog({ tenancyId }: { tenancyId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<TenancyEndReasonLike>('tenant_notice');
  const [endDate, setEndDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isPending, startTransition] = React.useTransition();

  const requiredDays = noticeDaysForEndReason(reason);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!endDate) {
      toast.error('Pick an end date');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/tenancies/${tenancyId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date: endDate, reason, notes: notes || null }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Could not end the tenancy');
        return;
      }
      toast.success('Tenancy ended');
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <StopCircle className="mr-2 h-4 w-4" />
          End tenancy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End this tenancy</DialogTitle>
          <DialogDescription>
            Section 21 (no-fault) is abolished under the Renters&apos; Rights Bill. Pick the
            statutory reason that applies — minimum notice is enforced server-side.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="end-reason">Reason</Label>
            <select
              id="end-reason"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value as TenancyEndReasonLike)}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Minimum statutory notice for this reason: <strong>{requiredDays} days</strong>.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-notes">Notes (optional)</Label>
            <Textarea
              id="end-notes"
              placeholder="Add context — useful for audit trail."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              End tenancy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
