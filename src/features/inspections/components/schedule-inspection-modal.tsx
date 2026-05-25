'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type InspectionType = 'routine_quarterly' | 'move_in' | 'move_out' | 'interim' | 'compliance';

const TYPE_LABELS: Record<InspectionType, string> = {
  routine_quarterly: 'Routine quarterly',
  move_in: 'Move-in inspection',
  move_out: 'Move-out inspection',
  interim: 'Interim / ad-hoc',
  compliance: 'Compliance check',
};

export type ScheduleInspectionPropertyOption = {
  id: string;
  name: string;
};

export type ScheduleInspectionModalProps = {
  slug: string;
  properties: ScheduleInspectionPropertyOption[];
};

/**
 * "Schedule inspection" modal — backs
 * `POST /api/landlord/[slug]/inspections`.
 *
 * Captures property, type, scheduled date and an optional inspector
 * label. Tenant notice is captured separately on the row detail page
 * (which is the right place for the 24-hour-notice email flow).
 */
export function ScheduleInspectionModal({ slug, properties }: ScheduleInspectionModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [propertyId, setPropertyId] = useState<string>(properties[0]?.id ?? '');
  const [type, setType] = useState<InspectionType>('routine_quarterly');
  const [scheduledFor, setScheduledFor] = useState(new Date().toISOString().slice(0, 10));
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      toast.error('Choose a property.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/landlord/${slug}/inspections`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          type,
          scheduled_for: scheduledFor,
          inspector_name: inspectorName.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Failed to schedule inspection');
      }
      toast.success('Inspection scheduled');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule inspection');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Schedule inspection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule inspection</DialogTitle>
          <DialogDescription>
            Book a new inspection on the calendar. Send the tenant notice from the row detail page
            once the date is confirmed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="insp-property">Property</Label>
            <select
              id="insp-property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
              disabled={busy}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="insp-type">Type</Label>
              <select
                id="insp-type"
                value={type}
                onChange={(e) => setType(e.target.value as InspectionType)}
                disabled={busy}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.keys(TYPE_LABELS) as InspectionType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="insp-date">Scheduled for</Label>
              <Input
                id="insp-date"
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                required
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="insp-inspector">Inspector (optional)</Label>
            <Input
              id="insp-inspector"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Self / surveyor name"
              maxLength={120}
              disabled={busy}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="insp-notes">Notes</Label>
            <textarea
              id="insp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              disabled={busy}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
