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
import { PropertyCreate, type PropertyType } from '@/core/schemas/property';

const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string; hint: string }[] = [
  { value: 'whole_property', label: 'Whole property', hint: 'Single household let' },
  { value: 'hmo_small', label: 'HMO (small)', hint: '3–4 occupants from 2+ households' },
  { value: 'hmo_large', label: 'HMO (large)', hint: '5+ occupants — mandatory licence' },
  { value: 'flat', label: 'Flat', hint: 'Self-contained flat' },
  { value: 'studio', label: 'Studio', hint: 'Self-contained studio' },
  { value: 'bedsit', label: 'Bedsit', hint: 'Single-room let' },
];

type PropertyFormIn = z.input<typeof PropertyCreate>;
type PropertyFormOut = z.output<typeof PropertyCreate>;

export function PropertyForm({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<PropertyFormIn, unknown, PropertyFormOut>({
    resolver: zodResolver(PropertyCreate),
    defaultValues: {
      name: '',
      type: 'hmo_small',
      address: { line1: '', line2: '', city: '', postcode: '', country: 'GB' },
      notes: '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(json?.error?.message ?? 'Could not create the property');
        return;
      }
      const json = (await res.json()) as { data: { id: string } };
      toast.success('Property added');
      router.push(`/landlord/${orgSlug}/properties/${json.data.id}`);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Property name</FormLabel>
                <FormControl>
                  <Input placeholder="42 Acacia Avenue" {...field} />
                </FormControl>
                <FormDescription>A nickname your team will recognise.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {PROPERTY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.hint}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>
                  HMO (large) automatically schedules a mandatory licence reminder.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.line1"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Address line 1</FormLabel>
                <FormControl>
                  <Input autoComplete="address-line1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.line2"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Address line 2 (optional)</FormLabel>
                <FormControl>
                  <Input autoComplete="address-line2" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Town / city</FormLabel>
                <FormControl>
                  <Input autoComplete="address-level2" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.postcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postcode</FormLabel>
                <FormControl>
                  <Input autoComplete="postal-code" placeholder="SW1A 1AA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any internal notes — access codes, parking, etc."
                    {...field}
                    value={field.value ?? ''}
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
            Create property
          </Button>
        </div>
      </form>
    </Form>
  );
}
