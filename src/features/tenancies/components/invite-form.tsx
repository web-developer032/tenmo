'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { TenancyInvite } from '@/core/schemas/tenancy';
import { useEmailExists } from '@/features/profiles/hooks/use-email-exists';

type InviteIn = z.input<typeof TenancyInvite>;
type InviteOut = z.output<typeof TenancyInvite>;

export type RoomOption = {
  id: string;
  name: string;
  default_rent_pence: number | null;
  default_rent_frequency: 'monthly' | 'weekly';
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'archived';
};

export function InviteForm({
  orgId,
  orgSlug,
  propertyId,
  rooms,
}: {
  orgId: string;
  orgSlug: string;
  propertyId: string;
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const inviteable = rooms.filter((r) => r.status !== 'archived');
  const defaultRoom = inviteable.find((r) => r.status === 'available') ?? inviteable[0];

  const form = useForm<InviteIn, unknown, InviteOut>({
    resolver: zodResolver(TenancyInvite),
    defaultValues: {
      property_id: propertyId,
      room_id: defaultRoom?.id ?? null,
      invite_email: '',
      start_date: new Date().toISOString().slice(0, 10),
      rent_pence: defaultRoom?.default_rent_pence ?? 0,
      rent_frequency: defaultRoom?.default_rent_frequency ?? 'monthly',
      rent_due_day: 1,
      deposit_pence: defaultRoom?.default_rent_pence
        ? Math.round((defaultRoom.default_rent_pence * 12 * 5) / 52)
        : 0,
      deposit_scheme: 'dps',
    },
  });

  const inviteEmail = form.watch('invite_email');
  const emailExists = useEmailExists(inviteEmail);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/tenancies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { tenancy: { id: string }; inviteUrl: string; emailSent: boolean };
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not create the invite');
        return;
      }

      if (json.data.emailSent) {
        toast.success('Invite sent — email on its way');
      } else {
        toast.success('Invite created — copy the link to share manually');
      }
      router.push(`/landlord/${orgSlug}/tenancies/${json.data.tenancy.id}`);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="invite_email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Tenant email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="tenant@example.com" {...field} />
                </FormControl>
                <FormDescription>
                  We&apos;ll email them a free, fee-less invite. Tenants are never charged on
                  Tenantly.
                </FormDescription>
                {emailExists === false ? (
                  <p
                    className="mt-1 inline-flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
                    role="status"
                  >
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      No Tenantly account found for this email — we&apos;ll send them an invite to
                      sign up. The invite link still works either way.
                    </span>
                  </p>
                ) : null}
                {emailExists === true ? (
                  <p className="mt-1 text-xs text-muted-foreground" role="status">
                    Recognised account — they&apos;ll see this invite the next time they sign in.
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="room_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Room</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                  >
                    <option value="">Whole property</option>
                    {inviteable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.status}
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
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rent_pence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rent (pence)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="65000"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>£650 = 65000 pence. We store everything in pence.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rent_frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="monthly">Monthly (pcm)</option>
                    <option value="weekly">Weekly (pw)</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rent_due_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rent due day (1–31)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={field.value ?? 1}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deposit_pence"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deposit (pence)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Capped at 5 weeks&apos; rent under the Tenant Fees Act.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deposit_scheme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deposit scheme</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="dps">DPS</option>
                    <option value="mydeposits">mydeposits</option>
                    <option value="tds">TDS</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send invite
          </Button>
        </div>
      </form>
    </Form>
  );
}
