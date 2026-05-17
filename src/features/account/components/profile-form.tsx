'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LOCALE_OPTIONS, THEME_OPTIONS, TIMEZONE_OPTIONS } from '@/core/constants/profile';
import { ProfileEditInput } from '@/core/schemas/profile';
import { updateProfileApi } from '../api/client';
import type { CurrentProfile } from '../loaders';

type FormIn = z.input<typeof ProfileEditInput>;
type FormOut = z.output<typeof ProfileEditInput>;

const SELECT_CLS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Profile edit form — used by `/account` for landlord, tenant and admin
 * personas alike (one profiles row per user, regardless of role).
 *
 * Design notes:
 *   - Sign-in email is shown read-only; changing the auth email needs the
 *     verification flow and isn't in MVP scope.
 *   - The form treats blank inputs as "leave alone" (see `optionalString`
 *     in `core/schemas/common.ts`) — same UX as the org-create form.
 *   - On success, we call `router.refresh()` so server components that
 *     also read from `profiles` (notifications page, app shell, etc.)
 *     pick up the new values without a full reload.
 */
export type ProfileFormProps = {
  initial: CurrentProfile;
};

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const defaults = React.useMemo<FormIn>(
    () => ({
      full_name: initial.full_name ?? '',
      preferred_name: initial.preferred_name ?? '',
      contact_email: initial.contact_email ?? '',
      contact_phone: initial.contact_phone ?? '',
      locale: initial.locale,
      timezone: initial.timezone,
      theme: initial.theme,
      marketing_opt_in: initial.marketing_opt_in,
    }),
    [initial],
  );

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(ProfileEditInput),
    defaultValues: defaults,
  });

  React.useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      try {
        const next = await updateProfileApi(values);
        toast.success('Profile saved');
        form.reset({
          full_name: next.full_name ?? '',
          preferred_name: next.preferred_name ?? '',
          contact_email: next.contact_email ?? '',
          contact_phone: next.contact_phone ?? '',
          locale: next.locale,
          timezone: next.timezone,
          theme: next.theme,
          marketing_opt_in: next.marketing_opt_in,
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save profile');
      }
    });
  });

  const dirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="profile-signin-email">Sign-in email</Label>
          <Input id="profile-signin-email" value={initial.email} readOnly disabled />
          <p className="text-sm text-muted-foreground">
            Used to sign in. Changing this requires re-verification and isn&apos;t available yet.
          </p>
        </div>

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Sara Morgan"
                  autoComplete="name"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>
                Used on tenancy agreements, notices and invoices. Required.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="preferred_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred name (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Sara"
                  autoComplete="nickname"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>What we&apos;ll greet you with in the UI.</FormDescription>
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
                  placeholder="hello@example.com"
                  autoComplete="email"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>
                Where tenants and landlords can reach you. Leave blank to use your sign-in email.
              </FormDescription>
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
                  autoComplete="tel"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Language</FormLabel>
                <FormControl>
                  <select {...field} className={SELECT_CLS} value={field.value ?? 'en-GB'}>
                    {LOCALE_OPTIONS.map((opt) => (
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
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time zone</FormLabel>
                <FormControl>
                  <select {...field} className={SELECT_CLS} value={field.value ?? 'Europe/London'}>
                    {TIMEZONE_OPTIONS.map((opt) => (
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
            name="theme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Theme</FormLabel>
                <FormControl>
                  <select {...field} className={SELECT_CLS} value={field.value ?? 'system'}>
                    {THEME_OPTIONS.map((opt) => (
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
            name="marketing_opt_in"
            render={({ field }) => (
              <FormItem className="flex h-full flex-col justify-end">
                <FormLabel>Product updates</FormLabel>
                <div className="flex h-10 items-center justify-between rounded-md border bg-background px-3">
                  <span className="text-sm text-muted-foreground">
                    Occasional emails about new features
                  </span>
                  <Switch
                    checked={field.value ?? false}
                    onCheckedChange={(v) => field.onChange(v)}
                    label="Marketing opt-in"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset(defaults)}
            disabled={!dirty || isPending}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!dirty || isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
