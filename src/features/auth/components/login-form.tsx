'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { loginAction } from '../actions';
import { LoginInput } from '../schemas';

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ redirect?: string; error?: string; email?: string }>;
}) {
  const router = useRouter();
  const params = React.use(searchParamsPromise);
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginInput),
    defaultValues: { email: params?.email ?? '', password: '' },
  });

  React.useEffect(() => {
    if (params?.error) {
      toast.error(decodeURIComponent(params.error));
    }
  }, [params?.error]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await loginAction(values, params?.redirect ?? '/dispatch');
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  });

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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Log in
        </Button>
      </form>
    </Form>
  );
}
