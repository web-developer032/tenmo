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
import { slugify } from '@/core/utils/slug';
import { CreateOrgInput } from '../schemas';

type CreateOrgIn = z.input<typeof CreateOrgInput>;
type CreateOrgOut = z.output<typeof CreateOrgInput>;

export function CreateOrgForm() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<CreateOrgIn, unknown, CreateOrgOut>({
    resolver: zodResolver(CreateOrgInput),
    defaultValues: {
      name: '',
      slug: '',
      contact_email: '',
      contact_phone: '',
    },
  });

  const watchName = form.watch('name');
  const watchSlug = form.watch('slug');

  React.useEffect(() => {
    if (!watchSlug && watchName) {
      const auto = slugify(watchName);
      if (auto && auto.length >= 3) {
        form.setValue('slug', auto, { shouldValidate: false });
      }
    }
  }, [watchName, watchSlug, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(json?.error?.message ?? 'Could not create your org');
        return;
      }

      const json = (await res.json()) as { data: { id: string; slug: string } };
      toast.success('Org created');
      router.push(`/landlord/${json.data.slug}`);
      router.refresh();
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organisation name</FormLabel>
              <FormControl>
                <Input placeholder="Morgan Lettings" autoComplete="organization" {...field} />
              </FormControl>
              <FormDescription>
                The name your tenants will see on invoices and notices.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workspace URL</FormLabel>
              <FormControl>
                <div className="flex items-stretch overflow-hidden rounded-md border">
                  <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">
                    tenantly.co.uk/landlord/
                  </span>
                  <Input
                    className="border-0 focus-visible:ring-0"
                    placeholder="morgan-lettings"
                    {...field}
                    value={field.value ?? ''}
                  />
                </div>
              </FormControl>
              <FormDescription>Lowercase letters, digits and hyphens only.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact email (optional)</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="hello@morganlettings.co.uk"
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
              <FormLabel>Contact phone (optional)</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+44 20 7946 0123"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create org and continue
        </Button>
      </form>
    </Form>
  );
}
