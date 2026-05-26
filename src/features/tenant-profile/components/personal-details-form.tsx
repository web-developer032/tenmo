'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
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
import { ProfileEditInput } from '@/core/schemas/profile';
import { updateProfileApi } from '@/features/account/api/client';
import type { CurrentProfile } from '@/features/account/loaders';

/**
 * "Personal details" card on the tenant profile page.
 *
 * Posts to the existing `PATCH /api/profile` route. We split `full_name`
 * into first/last on the wire but persist back as `full_name`; the same
 * server schema accepts either form because the underlying column is a
 * single string.
 */

const PersonalSchema = ProfileEditInput.pick({
  full_name: true,
  contact_email: true,
  contact_phone: true,
});

type FormIn = z.input<typeof PersonalSchema>;
type FormOut = z.output<typeof PersonalSchema>;

export function PersonalDetailsForm({
  initial,
  initials,
}: {
  initial: CurrentProfile;
  initials: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const defaults: FormIn = {
    full_name: initial.full_name ?? '',
    contact_email: initial.contact_email ?? initial.email,
    contact_phone: initial.contact_phone ?? '',
  };

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(PersonalSchema),
    defaultValues: defaults,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const next = await updateProfileApi(values);
        toast.success('Profile saved');
        form.reset({
          full_name: next.full_name ?? '',
          contact_email: next.contact_email ?? next.email,
          contact_phone: next.contact_phone ?? '',
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save profile');
      }
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-600 font-sans text-[18px] font-bold uppercase tracking-tight text-white">
            {initials}
          </span>
          <Button type="button" variant="outline" size="sm" disabled>
            <Camera className="h-4 w-4" />
            Change photo
          </Button>
        </div>

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Your full name" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_phone"
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

        <div className="flex justify-end pt-1">
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
