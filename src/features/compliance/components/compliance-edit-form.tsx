'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2 } from 'lucide-react';
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
import { ComplianceItemUpdate } from '@/core/schemas/compliance';
import { derivedExpiresAt } from '@/core/utils/compliance-rules';

type FormIn = z.input<typeof ComplianceItemUpdate>;
type FormOut = z.output<typeof ComplianceItemUpdate>;

export function ComplianceEditForm({
  item,
  orgSlug,
}: {
  item: {
    id: string;
    type: ComplianceType;
    issued_at: string | null;
    expires_at: string | null;
    notes: string | null;
  };
  orgSlug: string;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = React.useTransition();
  const [isDeleting, startDeleting] = React.useTransition();

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(ComplianceItemUpdate),
    defaultValues: {
      issued_at: item.issued_at,
      expires_at: item.expires_at,
      notes: item.notes,
    },
  });

  const watchedIssued = form.watch('issued_at');
  const watchedExpires = form.watch('expires_at');
  const projected = React.useMemo<string | null>(() => {
    if (!watchedIssued) return null;
    return derivedExpiresAt(item.type, watchedIssued);
  }, [item.type, watchedIssued]);

  const rule = COMPLIANCE_RULES[item.type];

  const onSubmit = form.handleSubmit((values) => {
    startSaving(async () => {
      const res = await fetch(`/api/compliance/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Could not update the certificate');
        return;
      }
      toast.success('Certificate updated');
      router.push(`/landlord/${orgSlug}/compliance`);
      router.refresh();
    });
  });

  const onDelete = () => {
    if (!confirm('Delete this certificate? This cannot be undone.')) return;
    startDeleting(async () => {
      const res = await fetch(`/api/compliance/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(json?.error?.message ?? 'Could not delete the certificate');
        return;
      }
      toast.success('Certificate deleted');
      router.push(`/landlord/${orgSlug}/compliance`);
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
          <p className="font-medium">{rule?.label}</p>
          <p className="text-muted-foreground">{rule?.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
                  />
                </FormControl>
                {!watchedExpires && projected ? (
                  <FormDescription>
                    Defaults to <strong>{projected}</strong> if blank.
                  </FormDescription>
                ) : null}
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
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
