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

type DocumentType = 'british_passport' | 'brp_card' | 'share_code' | 'eu_settlement' | 'other';

const DOC_LABELS: Record<DocumentType, string> = {
  british_passport: 'British passport',
  brp_card: 'BRP card',
  share_code: 'Share code (UKVI)',
  eu_settlement: 'EU Settlement (ILR)',
  other: 'Other',
};

const TIME_LIMITED: DocumentType[] = ['brp_card', 'share_code'];

export type LogRtrTenancyOption = {
  id: string;
  label: string;
};

export type LogRtrModalProps = {
  slug: string;
  tenancies: LogRtrTenancyOption[];
  initialTenancyId?: string;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'ghost';
};

/**
 * "Log new RtR check" modal — writes to
 * `POST /api/landlord/[slug]/tenancies/[id]/rtr-check`.
 *
 * The share-code field and expiry date show up conditionally based on
 * the document type (share codes / BRP have time-limited leave; British
 * passports + EU settlement scheme tickets are permanent).
 */
export function LogRtrModal({
  slug,
  tenancies,
  initialTenancyId,
  triggerLabel = 'Log new check',
  triggerVariant = 'default',
}: LogRtrModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [tenancyId, setTenancyId] = useState<string>(initialTenancyId ?? tenancies[0]?.id ?? '');
  const [documentType, setDocumentType] = useState<DocumentType>('british_passport');
  const [shareCode, setShareCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [checkedAt, setCheckedAt] = useState(new Date().toISOString().slice(0, 10));

  const timeLimited = TIME_LIMITED.includes(documentType);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenancyId) {
      toast.error('Choose a tenancy.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/landlord/${slug}/tenancies/${tenancyId}/rtr-check`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentType,
          share_code: documentType === 'share_code' ? shareCode.trim() || null : null,
          expires_at: timeLimited && expiresAt ? expiresAt : null,
          checked_at: new Date(`${checkedAt}T00:00:00Z`).toISOString(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Failed to log RtR check');
      }
      toast.success('Right-to-Rent check logged');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log RtR check');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant === 'ghost' ? 'ghost' : 'default'}>
          {triggerVariant === 'ghost' ? null : <Plus className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Right-to-Rent check</DialogTitle>
          <DialogDescription>
            Record the evidence you reviewed. If the tenant has time-limited leave we&apos;ll track
            the re-check deadline automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="rtr-tenancy">Tenancy</Label>
            <select
              id="rtr-tenancy"
              value={tenancyId}
              onChange={(e) => setTenancyId(e.target.value)}
              required
              disabled={busy}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {tenancies.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rtr-doc">Document type</Label>
              <select
                id="rtr-doc"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                disabled={busy}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.keys(DOC_LABELS) as DocumentType[]).map((d) => (
                  <option key={d} value={d}>
                    {DOC_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="rtr-checked">Check date</Label>
              <Input
                id="rtr-checked"
                type="date"
                value={checkedAt}
                onChange={(e) => setCheckedAt(e.target.value)}
                required
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          {documentType === 'share_code' ? (
            <div>
              <Label htmlFor="rtr-share">Share code</Label>
              <Input
                id="rtr-share"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value.toUpperCase())}
                placeholder="W4X-7KL-M29"
                maxLength={11}
                disabled={busy}
                className="mt-1"
              />
            </div>
          ) : null}
          {timeLimited ? (
            <div>
              <Label htmlFor="rtr-expires">Re-check due</Label>
              <Input
                id="rtr-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={busy}
                className="mt-1"
              />
              <p className="mt-1 text-[12px] text-ink-light">
                When the tenant&apos;s leave to remain expires. We&apos;ll flag the row 60 days
                before this date.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Log check'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
