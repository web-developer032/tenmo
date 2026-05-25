'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type PersonalDetailsInitial = {
  full_name: string | null;
  preferred_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

/**
 * Personal-details form for `/landlord/[slug]/profile`. Reuses the
 * shared `/api/profile` PATCH endpoint — RLS enforces "self only" so
 * no extra org check is needed.
 */
export function PersonalDetailsForm({ initial }: { initial: PersonalDetailsInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: initial.full_name ?? '',
    preferred_name: initial.preferred_name ?? '',
    contact_email: initial.contact_email ?? '',
    contact_phone: initial.contact_phone ?? '',
  });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            full_name: form.full_name.trim() || null,
            preferred_name: form.preferred_name.trim() || null,
            contact_email: form.contact_email.trim() || null,
            contact_phone: form.contact_phone.trim() || null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          toast.error(j?.error?.message ?? 'Could not save profile');
          return;
        }
        toast.success('Profile updated');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save profile');
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pd-name">Full name</Label>
          <Input
            id="pd-name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            disabled={pending}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="pd-pref">Preferred name</Label>
          <Input
            id="pd-pref"
            value={form.preferred_name}
            onChange={(e) => setForm({ ...form, preferred_name: e.target.value })}
            disabled={pending}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="pd-email">Email address</Label>
        <Input
          id="pd-email"
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          disabled={pending}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="pd-phone">Phone number</Label>
        <Input
          id="pd-phone"
          value={form.contact_phone}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          disabled={pending}
          className="mt-1"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
