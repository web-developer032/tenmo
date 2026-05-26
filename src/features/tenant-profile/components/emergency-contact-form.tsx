'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { updateProfileApi } from '@/features/account/api/client';
import type { CurrentProfile } from '@/features/account/loaders';

/**
 * "Emergency contact" card on the tenant profile page.
 *
 * Posts to `PATCH /api/profile` with `{ emergency_contact: { … } | null }`
 * which the Zod schema in `core/schemas/profile.ts` already accepts.
 */

const EmergencyContactSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal('')),
  relationship: z.string().trim().max(60).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
});

type FormIn = z.input<typeof EmergencyContactSchema>;
type FormOut = z.output<typeof EmergencyContactSchema>;

export function EmergencyContactForm({ initial }: { initial: CurrentProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const defaults: FormIn = {
    name: initial.emergency_contact?.name ?? '',
    relationship: initial.emergency_contact?.relationship ?? '',
    phone: initial.emergency_contact?.phone ?? '',
  };

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(EmergencyContactSchema),
    defaultValues: defaults,
  });

  const hasAnyValue = Boolean(
    initial.emergency_contact?.name ||
      initial.emergency_contact?.relationship ||
      initial.emergency_contact?.phone,
  );

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const allEmpty = !values.name && !values.relationship && !values.phone;
        const next = await updateProfileApi({
          emergency_contact: allEmpty
            ? null
            : {
                name: values.name || null,
                relationship: values.relationship || null,
                phone: values.phone || null,
              },
        });
        toast.success(allEmpty ? 'Emergency contact removed' : 'Emergency contact saved');
        form.reset({
          name: next.emergency_contact?.name ?? '',
          relationship: next.emergency_contact?.relationship ?? '',
          phone: next.emergency_contact?.phone ?? '',
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save emergency contact');
      }
    });
  });

  const onRemove = () => {
    startTransition(async () => {
      try {
        await updateProfileApi({ emergency_contact: null });
        toast.success('Emergency contact removed');
        form.reset({ name: '', relationship: '', phone: '' });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove contact');
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-stone-600">
          Person we should call in case of emergency. Visible only to you and our support team.
        </p>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Layla Lee" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="relationship"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Relationship</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Sister" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone number</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+44 7700 900000"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          {hasAnyValue ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={isPending}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={isPending || !form.formState.isDirty}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
