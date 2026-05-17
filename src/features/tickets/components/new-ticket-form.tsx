'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  TICKET_CATEGORY_RULES,
  TICKET_CATEGORY_VALUES,
  TICKET_SEVERITY_RULES,
  TICKET_SEVERITY_VALUES,
  type TicketCategory,
  type TicketSeverity,
} from '@/core/constants/tickets';
import { CreateTicketInput } from '@/core/schemas/ticket';
import { triageTicket } from '@/core/utils/ticket-rules';
import { TicketSeverityBadge } from './ticket-badges';

type FormIn = z.input<typeof CreateTicketInput>;
type FormOut = z.output<typeof CreateTicketInput>;

export type TenancyOption = {
  tenancy_id: string;
  property_id: string;
  property_name: string;
  room_id: string | null;
  room_name: string | null;
};

/**
 * Create-ticket form for tenants. We pre-fill property/room/tenancy from the
 * tenancy options the page passed us, which RLS already scoped to "what the
 * tenant can raise tickets against".
 *
 * Triage runs locally in the browser as the user types — instant feedback,
 * zero server round-trips. The same function runs again on the server, so
 * the suggestion stored in the DB is always the canonical one.
 */
export function NewTicketForm({
  tenancies,
  redirectBase,
}: {
  tenancies: TenancyOption[];
  /** Where to send the user after creation. e.g. "/tenant/tickets" or "/landlord/abc/tickets" */
  redirectBase: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  const initialTenancy = tenancies[0];
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(CreateTicketInput),
    defaultValues: {
      property_id: initialTenancy?.property_id ?? '',
      room_id: initialTenancy?.room_id ?? null,
      tenancy_id: initialTenancy?.tenancy_id ?? null,
      title: '',
      description: '',
      category: undefined,
      severity: undefined,
      attachment_paths: [],
    },
  });

  const title = form.watch('title');
  const description = form.watch('description');
  const triage = React.useMemo(
    () =>
      title.length > 2 || description.length > 5 ? triageTicket({ title, description }) : null,
    [title, description],
  );

  const onTenancyChange = (tenancyId: string) => {
    const t = tenancies.find((x) => x.tenancy_id === tenancyId);
    if (!t) return;
    form.setValue('tenancy_id', t.tenancy_id, { shouldDirty: true });
    form.setValue('property_id', t.property_id, { shouldDirty: true });
    form.setValue('room_id', t.room_id, { shouldDirty: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { ticket: { id: string } };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not create the ticket');
        return;
      }
      toast.success('Ticket raised — your landlord has been notified.');
      router.push(`${redirectBase}/${json.data.ticket.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  });

  if (tenancies.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        You need an active tenancy to raise a maintenance ticket.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-5">
        {tenancies.length > 1 ? (
          <FormField
            control={form.control}
            name="tenancy_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Which home?</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={field.value ?? ''}
                    onChange={(e) => onTenancyChange(e.target.value)}
                  >
                    {tenancies.map((t) => (
                      <option key={t.tenancy_id} value={t.tenancy_id}>
                        {t.property_name}
                        {t.room_name ? ` — ${t.room_name}` : ''}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Boiler making banging noise" maxLength={140} />
              </FormControl>
              <FormDescription>A short summary helps us route this quickly.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What's happening?</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={6}
                  maxLength={5000}
                  placeholder="When did it start? Has anything changed? Any safety concerns?"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange((e.target.value || undefined) as TicketCategory | undefined)
                    }
                  >
                    <option value="">Auto — let us pick</option>
                    {TICKET_CATEGORY_VALUES.map((c) => (
                      <option key={c} value={c}>
                        {TICKET_CATEGORY_RULES[c].label}
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
            name="severity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Severity</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange((e.target.value || undefined) as TicketSeverity | undefined)
                    }
                  >
                    <option value="">Auto — based on description</option>
                    {TICKET_SEVERITY_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_SEVERITY_RULES[s].label}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {triage ? (
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 text-amber-500" />
            <div className="space-y-1">
              <div className="font-medium text-foreground">AI suggestion</div>
              <div className="flex flex-wrap items-center gap-2">
                <span>Category: {TICKET_CATEGORY_RULES[triage.category].label}</span>
                <TicketSeverityBadge severity={triage.severity} />
              </div>
              <div>{triage.reason}</div>
              <div className="text-[11px]">
                Leave fields on <em>Auto</em> to use this suggestion, or pick your own.
              </div>
            </div>
          </div>
        ) : null}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Raise ticket
        </Button>
      </form>
    </Form>
  );
}
