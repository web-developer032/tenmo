'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type BusinessDetailsInitial = {
  name: string;
  vat_number: string | null;
  company_number: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

/**
 * Business-details form on `/landlord/[slug]/profile`. PATCHes
 * `/api/landlord/[slug]/org`, which is owner-only — non-owners see
 * a read-only version (rendered by the parent page).
 */
export function BusinessDetailsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: BusinessDetailsInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: initial.name,
    vat_number: initial.vat_number ?? '',
    company_number: initial.company_number ?? '',
    contact_email: initial.contact_email ?? '',
    contact_phone: initial.contact_phone ?? '',
  });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/landlord/${slug}/org`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            vat_number: form.vat_number.trim() || null,
            company_number: form.company_number.trim() || null,
            contact_email: form.contact_email.trim() || null,
            contact_phone: form.contact_phone.trim() || null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not save business details');
          return;
        }
        toast.success('Business details updated');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save business details');
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="bd-name">Company / trading name</Label>
        <Input
          id="bd-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          minLength={2}
          maxLength={120}
          disabled={pending}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bd-company">UTR / Company number</Label>
          <Input
            id="bd-company"
            value={form.company_number}
            onChange={(e) => setForm({ ...form, company_number: e.target.value })}
            maxLength={40}
            disabled={pending}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="bd-vat">VAT number (optional)</Label>
          <Input
            id="bd-vat"
            value={form.vat_number}
            onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            placeholder="GB 123 456 789"
            maxLength={40}
            disabled={pending}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bd-email">Business email</Label>
          <Input
            id="bd-email"
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            disabled={pending}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="bd-phone">Business phone</Label>
          <Input
            id="bd-phone"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            disabled={pending}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save business details'}
        </Button>
      </div>
    </form>
  );
}
