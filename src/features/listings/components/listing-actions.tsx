'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LandlordRoomListingRow } from '@/features/listings/loaders';

/**
 * Inline action panel attached to each row of the landlord listings manager.
 *
 * Renders the right CTAs for the current `listing_status`:
 *   draft     → publish form
 *   published → pause / close
 *   paused    → resume / close
 *   closed    → re-open
 *
 * Also surfaces the description / available-from inline edit for draft and
 * paused rows.
 */
export function ListingActions({ row, orgSlug }: { row: LandlordRoomListingRow; orgSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState(row.listing_description ?? '');
  const [availableFrom, setAvailableFrom] = useState(row.listing_available_from ?? '');
  const [billsIncluded, setBillsIncluded] = useState(row.listing_bills_included);

  async function call(path: string, body: object) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? 'Action failed');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const base = `/api/landlord/${orgSlug}/listings/${row.id}`;

  if (row.listing_status === 'draft' || row.listing_status === 'paused') {
    return (
      <form
        className="grid grid-cols-1 gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await call(`${base}/publish`, {
            listing_description: description.trim() || undefined,
            listing_available_from: availableFrom || undefined,
            listing_bills_included: billsIncluded,
          });
          toast.success(
            row.listing_status === 'paused' ? 'Listing republished' : 'Listing published',
          );
        }}
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`desc-${row.id}`}>Description</Label>
          <Textarea
            id={`desc-${row.id}`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's special about this room? (size, light, transport links, vibe of the house)"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`avail-${row.id}`}>Available from</Label>
          <Input
            id={`avail-${row.id}`}
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
          />
        </div>
        <label className="flex items-end gap-2 pb-1">
          <input
            type="checkbox"
            checked={billsIncluded}
            onChange={(e) => setBillsIncluded(e.target.checked)}
            className="h-4 w-4 rounded border"
          />
          <span className="text-sm">Bills included</span>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Publishing…'
              : row.listing_status === 'paused'
                ? 'Republish'
                : 'Publish listing'}
          </Button>
          {row.listing_status === 'paused' ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                await call(`${base}/close`, {});
                toast.success('Listing closed');
              }}
            >
              Close listing
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  if (row.listing_status === 'published') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            await call(`${base}/pause`, {});
            toast.success('Listing paused');
          }}
        >
          Pause
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            await call(`${base}/close`, {});
            toast.success('Listing closed');
          }}
        >
          Close
        </Button>
      </div>
    );
  }

  // closed
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          await call(`${base}/close`, { reopen: true });
          toast.success('Listing reopened — set details and republish.');
        }}
      >
        Re-open
      </Button>
    </div>
  );
}
