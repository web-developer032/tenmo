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
import { cn } from '@/lib/cn';

type Trade =
  | 'plumbing'
  | 'electrical'
  | 'gas'
  | 'general'
  | 'security'
  | 'heating'
  | 'locksmith'
  | 'roofing'
  | 'cleaning';

const TRADE_LABELS: Record<Trade, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  gas: 'Gas',
  general: 'General',
  security: 'Security',
  heating: 'Heating',
  locksmith: 'Locksmith',
  roofing: 'Roofing',
  cleaning: 'Cleaning',
};

export type AddContractorModalProps = {
  slug: string;
};

/**
 * "Add contractor" modal — posts to
 * `POST /api/landlord/[slug]/contractors`. Trades are chosen via toggle
 * chips because the schema lets a single supplier do multiple trades
 * (e.g. a heating engineer that's also Gas Safe registered).
 */
export function AddContractorModal({ slug }: AddContractorModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [coverage, setCoverage] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [gasSafe, setGasSafe] = useState('');
  const [niceic, setNiceic] = useState('');
  const [rating, setRating] = useState<number | ''>('');

  const toggleTrade = (t: Trade) => {
    setTrades((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a contractor name.');
      return;
    }
    setBusy(true);
    try {
      const pence = dayRate ? Math.round(Number.parseFloat(dayRate) * 100) : null;
      const areas = coverage
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/landlord/${slug}/contractors`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact_name: contactName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          trades,
          coverage_areas: areas,
          day_rate_pence: pence,
          gas_safe_number: gasSafe.trim() || null,
          niceic_number: niceic.trim() || null,
          rating: typeof rating === 'number' ? rating : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Failed to add contractor');
      }
      toast.success('Contractor added');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contractor');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add contractor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contractor</DialogTitle>
          <DialogDescription>
            Save your supplier&apos;s details once — assign them to maintenance tickets and
            compliance renewals in one click later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="con-name">Business name</Label>
              <Input
                id="con-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="con-contact">Contact name</Label>
              <Input
                id="con-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                maxLength={120}
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="con-phone">Phone</Label>
              <Input
                id="con-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={40}
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="con-email">Email</Label>
              <Input
                id="con-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Trades</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(TRADE_LABELS) as Trade[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTrade(t)}
                  disabled={busy}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition',
                    trades.includes(t)
                      ? 'border-forest-600 bg-foam text-forest-700'
                      : 'border-border-soft bg-white text-ink-light hover:border-forest-600/40 hover:text-forest-600',
                  )}
                >
                  {TRADE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="con-coverage">Coverage areas</Label>
            <Input
              id="con-coverage"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              placeholder="Cardiff, Newport"
              disabled={busy}
              className="mt-1"
            />
            <p className="mt-1 text-[12px] text-ink-light">
              Comma-separated cities or postcode areas.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="con-day-rate">Day rate (£)</Label>
              <Input
                id="con-day-rate"
                type="number"
                step="0.01"
                min="0"
                value={dayRate}
                onChange={(e) => setDayRate(e.target.value)}
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="con-gas">Gas Safe</Label>
              <Input
                id="con-gas"
                value={gasSafe}
                onChange={(e) => setGasSafe(e.target.value)}
                placeholder="GS88123"
                maxLength={40}
                disabled={busy}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="con-niceic">NICEIC</Label>
              <Input
                id="con-niceic"
                value={niceic}
                onChange={(e) => setNiceic(e.target.value)}
                placeholder="NI44219"
                maxLength={40}
                disabled={busy}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="con-rating">Rating (1–5)</Label>
            <Input
              id="con-rating"
              type="number"
              min="1"
              max="5"
              step="1"
              value={rating}
              onChange={(e) => setRating(e.target.value ? Number(e.target.value) : '')}
              disabled={busy}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Add contractor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
