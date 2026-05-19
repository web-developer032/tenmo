'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  initial: {
    full_name: string | null;
    preferred_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  };
};

/**
 * Personal details form on `/admin/profile`. Posts a PATCH to the
 * shared `/api/profile` route — that endpoint already enforces
 * "self only" via Supabase RLS, so no extra admin gating is needed.
 */
export function AdminProfileForm({ initial }: Props) {
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
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="full-name">Full name</Label>
        <Input
          id="full-name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="preferred">Preferred name</Label>
        <Input
          id="preferred"
          value={form.preferred_name}
          onChange={(e) => setForm({ ...form, preferred_name: e.target.value })}
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-email">Contact email</Label>
        <Input
          id="contact-email"
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          disabled={pending}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-phone">Contact phone</Label>
        <Input
          id="contact-phone"
          value={form.contact_phone}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          disabled={pending}
        />
      </div>
      <div className="col-span-full flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
