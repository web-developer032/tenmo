'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { RoomCreate, type RoomFurnishing } from '@/core/schemas/room';

const FURNISHING_OPTIONS: { value: RoomFurnishing; label: string }[] = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'part_furnished', label: 'Part-furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
];

type RoomFormValues = {
  name: string;
  description?: string | null;
  size_sqm?: number | null;
  has_ensuite: boolean;
  has_double_bed: boolean;
  furnishing: RoomFurnishing;
  default_rent_gbp?: number | null;
  default_rent_frequency: 'monthly' | 'weekly';
  bills_included: boolean;
};

export function RoomForm({ orgSlug, propertyId }: { orgSlug: string; propertyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<RoomFormValues>({
    defaultValues: {
      name: '',
      description: '',
      size_sqm: null,
      has_ensuite: false,
      has_double_bed: false,
      furnishing: 'part_furnished',
      default_rent_gbp: null,
      default_rent_frequency: 'monthly',
      bills_included: false,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const candidate = {
      name: values.name,
      description: values.description ?? null,
      size_sqm: values.size_sqm ?? null,
      has_ensuite: values.has_ensuite,
      has_double_bed: values.has_double_bed,
      furnishing: values.furnishing,
      default_rent_pence:
        values.default_rent_gbp == null ? null : Math.round(values.default_rent_gbp * 100),
      default_rent_frequency: values.default_rent_frequency,
      bills_included: values.bills_included,
    };

    const parsed = RoomCreate.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message ?? 'Please fix the highlighted fields');
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/properties/${propertyId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(json?.error?.message ?? 'Could not create the room');
        return;
      }
      toast.success('Room added');
      router.push(`/landlord/${orgSlug}/properties/${propertyId}`);
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
            rules={{ required: 'Give the room a name' }}
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Room name</FormLabel>
                <FormControl>
                  <Input placeholder="Room 1 — Front double" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="size_sqm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size (m²)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="12.5"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  Min 6.51 m² for a single, 10.22 m² for a double (HMO).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="furnishing"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Furnishing</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {FURNISHING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
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
            name="default_rent_gbp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default rent (£)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    placeholder="650"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>Stored in pence under the hood.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="default_rent_frequency"
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
            name="description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="What makes this room special?"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <fieldset className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
          <legend className="px-1 text-sm font-medium">Features</legend>
          <CheckboxField
            label="En-suite bathroom"
            checked={form.watch('has_ensuite')}
            onChange={(v) => form.setValue('has_ensuite', v)}
          />
          <CheckboxField
            label="Double bed"
            checked={form.watch('has_double_bed')}
            onChange={(v) => form.setValue('has_double_bed', v)}
          />
          <CheckboxField
            label="Bills included"
            checked={form.watch('bills_included')}
            onChange={(v) => form.setValue('bills_included', v)}
          />
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add room
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
