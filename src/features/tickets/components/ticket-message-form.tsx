'use client';

import { Loader2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AttachmentPicker } from './attachment-picker';

/**
 * Comment box for the ticket detail page. Shared between landlord and tenant.
 *
 * Behaviour:
 *  - Posts to `/api/tickets/{id}/messages` with body + attachments.
 *  - Disables submission while attachments are uploading so we never lose
 *    a path mid-flight.
 *  - On success, refreshes the page (the parent server component re-reads
 *    the timeline) and clears state.
 */
export function TicketMessageForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [paths, setPaths] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error('Type a message first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed, attachment_paths: paths }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not post the message');
        return;
      }
      setBody('');
      setPaths([]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border bg-card p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment, photo, or update…"
        rows={3}
        maxLength={5000}
        disabled={submitting}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AttachmentPicker
          ticketId={ticketId}
          onChange={setPaths}
          onPendingChange={setUploading}
          disabled={submitting}
        />
        <Button type="submit" disabled={submitting || uploading || body.trim().length === 0}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send
        </Button>
      </div>
    </form>
  );
}
