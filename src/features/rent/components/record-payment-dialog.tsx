'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ManualPaymentInput } from '@/core/schemas/rent';
import { MANUAL_METHOD_OPTIONS } from '../status-display';

type FormIn = z.input<typeof ManualPaymentInput>;
type FormOut = z.output<typeof ManualPaymentInput>;

export type ChargeOption = {
  id: string;
  label: string;
  outstandingPence: number;
};

/**
 * Landlord dialog for recording a manual rent payment.
 *
 * Defaults the amount to the largest open charge so the common case is
 * "tenant paid the latest rent" with one click. Otherwise the landlord can
 * type any amount and we let the server FIFO-allocate it.
 */
export function RecordPaymentDialog({
  tenancyId,
  defaultAmountPence,
  charges,
}: {
  tenancyId: string;
  defaultAmountPence: number;
  charges: ChargeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(ManualPaymentInput),
    defaultValues: {
      amount_pence: defaultAmountPence,
      method: 'manual_bank_transfer',
      paid_on: new Date().toISOString().slice(0, 10),
      charge_id: charges[0]?.id ?? null,
      notes: null,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        amount_pence: defaultAmountPence,
        method: 'manual_bank_transfer',
        paid_on: new Date().toISOString().slice(0, 10),
        charge_id: charges[0]?.id ?? null,
        notes: null,
      });
    }
  }, [open, defaultAmountPence, charges, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = {
        ...values,
        amount_pence: Number(values.amount_pence),
        charge_id: values.charge_id || null,
      };
      const res = await fetch(`/api/tenancies/${tenancyId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not record the payment');
        return;
      }
      toast.success('Payment recorded');
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record rent payment</DialogTitle>
          <DialogDescription>
            Log a payment received outside the platform (bank transfer, cash, etc.). Tenants will
            see this in their ledger immediately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="amount_pence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (pence)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Whole pence — e.g. 55000 for £550.00. We'll allocate it to the selected charge
                    first, then FIFO across the rest.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paid_on"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid on</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {MANUAL_METHOD_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="charge_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply to (optional)</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    >
                      <option value="">Auto (oldest open charge first)</option>
                      {charges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    Leave on Auto for normal rent. Pick a specific charge if you're settling an
                    arrear or correcting an overpayment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Optional — bank ref, sort code last 4, etc."
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
