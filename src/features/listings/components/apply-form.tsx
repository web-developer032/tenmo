'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Tenant-side "Apply" form — small client island on the public detail page.
 *
 * Anonymous viewers see a "Sign up to apply" CTA instead. Signed-in viewers
 * see this textarea + submit, which posts to /api/listings/[roomId]/apply.
 */
export function ApplyForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${roomId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() ? message.trim() : undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Could not send your application');
      }
      toast.success('Application sent — the landlord has been notified.');
      setDone(true);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your application');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-md border border-success/40 bg-success/10 p-4 text-sm">
        <p className="font-medium text-success">Application sent</p>
        <p className="mt-1 text-muted-foreground">
          Track its status on your{' '}
          <a className="underline" href="/tenant/applications">
            applications page
          </a>
          . The landlord will reply via in-app message and email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-card p-4">
      <div className="space-y-1">
        <Label htmlFor="application-message">Message (optional)</Label>
        <Textarea
          id="application-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="A few lines about you, your work, and your move-in timeline."
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Apply for this room'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Tenants are free on Tenantly — applying never costs you anything.
      </p>
    </form>
  );
}
