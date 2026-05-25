'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type SubmitMtdQuarterOption = {
  quarter: string;
  label: string;
  status: 'draft' | 'generated' | 'submitted';
};

export type SubmitMtdProps = {
  slug: string;
  quarters: SubmitMtdQuarterOption[];
};

/**
 * Inline "Submit to HMRC" form on the financials Submit tab.
 *
 * Posts to `/api/landlord/[slug]/mtd-submissions` to lock the figures
 * for the chosen quarter, then drops the user onto the CSV export
 * endpoint to download the bridging file.
 */
export function SubmitMtdForm({ slug, quarters }: SubmitMtdProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<'csv_export' | 'direct_api'>('csv_export');
  const [quarter, setQuarter] = useState<string>(quarters[0]?.quarter ?? '');
  const [utr, setUtr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quarter) {
      toast.error('Choose a quarter to submit.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/landlord/${slug}/mtd-submissions`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quarter,
          submission_method: method,
          submission_ref: utr.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Failed to submit MTD figures');
      }
      toast.success(
        method === 'direct_api' ? 'Submission recorded' : 'MTD export ready — download started',
      );
      router.refresh();
      if (method === 'csv_export') {
        window.location.href = `/api/landlord/${slug}/financials/export`;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit MTD figures');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-card bg-foam px-4 py-3 text-[13px] leading-relaxed text-forest-700">
        Tenantly is MTD-ready. Your quarterly figures are auto-compiled from your income and expense
        records. You can submit directly via a bridging connection or export a compatible file.
      </div>
      <div>
        <Label htmlFor="mtd-method">Submission method</Label>
        <select
          id="mtd-method"
          value={method}
          onChange={(e) => setMethod(e.target.value as 'csv_export' | 'direct_api')}
          disabled={busy}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="csv_export">
            Export CSV for bridging software (FreeAgent, Xero, QuickBooks)
          </option>
          <option value="direct_api">Direct HMRC API submission (coming soon)</option>
        </select>
      </div>
      <div>
        <Label htmlFor="mtd-quarter">Tax quarter</Label>
        <select
          id="mtd-quarter"
          value={quarter}
          onChange={(e) => setQuarter(e.target.value)}
          disabled={busy}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {quarters.map((q) => (
            <option key={q.quarter} value={q.quarter}>
              {q.label}
              {q.status === 'submitted' ? ' — already submitted' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="mtd-utr">UTR number (optional)</Label>
        <Input
          id="mtd-utr"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="1234567890"
          maxLength={20}
          disabled={busy}
          className="mt-1"
        />
      </div>
      <Button type="submit" className="w-full justify-center" disabled={busy}>
        {busy ? 'Generating…' : 'Generate MTD export'}
      </Button>
    </form>
  );
}
