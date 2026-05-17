'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { magicLinkAction } from '../actions';
import { MagicLinkInput } from '../schemas';

export function MagicLinkForm() {
  const [isPending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);

  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(MagicLinkInput),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await magicLinkAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    });
  });

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="h-10 w-10 text-primary" />
        <h3 className="text-lg font-semibold">Check your inbox</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a sign-in link to{' '}
          <span className="font-medium text-foreground">{form.getValues('email')}</span>.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send magic link
        </Button>
      </form>
    </Form>
  );
}
