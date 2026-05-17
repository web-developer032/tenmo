'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
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
import { COMPLIANCE_RULES, type ComplianceType } from '@/core/constants/compliance';
import { ComplianceItemCreate } from '@/core/schemas/compliance';
import { derivedExpiresAt } from '@/core/utils/compliance-rules';

type FormIn = z.input<typeof ComplianceItemCreate>;
type FormOut = z.output<typeof ComplianceItemCreate>;

export type PropertyOption = {
  id: string;
  name: string;
};

/**
 * Add a compliance item.
 *
 * Auto-derives `expires_at` from `issued_at + validityMonths` if the user
 * leaves the expiry field blank — but lets them override (e.g. for
 * shorter-than-default councils' HMO licences).
 */
export function ComplianceForm({
  orgId,
  orgSlug,
  properties,
  defaultPropertyId,
  defaultType,
}: {
  orgId: string;
  orgSlug: string;
  properties: PropertyOption[];
  defaultPropertyId?: string;
  defaultType?: ComplianceType;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(ComplianceItemCreate),
    defaultValues: {
      type: defaultType ?? 'gas_safety',
      property_id: defaultPropertyId ?? properties[0]?.id ?? null,
      room_id: null,
      tenancy_id: null,
      issued_at: null,
      expires_at: null,
      notes: null,
    },
  });

  const watchedType = form.watch('type');
  const watchedIssued = form.watch('issued_at');
  const watchedExpires = form.watch('expires_at');

  const projected = React.useMemo<string | null>(() => {
    if (!watchedIssued) return null;
    return derivedExpiresAt(watchedType as ComplianceType, watchedIssued);
  }, [watchedType, watchedIssued]);

  const rule = COMPLIANCE_RULES[watchedType as ComplianceType];

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { item: { id: string } };
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not save the certificate');
        return;
      }
      toast.success('Certificate saved');
      router.push(`/landlord/${orgSlug}/compliance`);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Certificate type</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Object.values(COMPLIANCE_RULES).map((r) => (
                      <option key={r.type} value={r.type}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>{rule?.description}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="property_id"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Property</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                  >
                    <option value="">Select a property</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
            name="issued_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issued on</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expires_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expires on</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    placeholder={projected ?? ''}
                  />
                </FormControl>
                {!watchedExpires && projected ? (
                  <FormDescription>
                    We&apos;ll default to <strong>{projected}</strong> based on the {rule?.label}{' '}
                    validity period if you leave this blank.
                  </FormDescription>
                ) : (
                  <FormDescription>
                    Leave blank for items with no fixed expiry (e.g. smoke alarm tests).
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Optional — e.g. engineer reference, test results, council reference."
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
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
            Save certificate
          </Button>
        </div>
      </form>
    </Form>
  );
}
