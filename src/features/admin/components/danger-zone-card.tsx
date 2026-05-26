'use client';

import { AlertTriangle, ShieldOff, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * "Danger Zone" card surfaced at the bottom of /admin/users.
 *
 * Two row affordances:
 *   - Suspend a landlord  ─ org slug → POST /api/admin/orgs/[id]/suspend
 *   - Delete a landlord   ─ org slug → POST /api/admin/orgs/[id]/delete
 *
 * Both actions require super admin; the card is disabled (read-only)
 * otherwise. We keep the picker dead-simple — paste/type the slug —
 * because every existing /admin/orgs row already exposes the full
 * suspend + delete affordances inline. This card is the "I know
 * exactly which landlord I want to nuke" power tool.
 */
export function DangerZoneCard({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState<'suspend' | 'delete' | null>(null);

  async function lookupOrgId(slugOrName: string): Promise<{ id: string; name: string } | null> {
    const trimmed = slugOrName.trim();
    if (!trimmed) return null;
    const res = await fetch(`/api/admin/orgs?q=${encodeURIComponent(trimmed)}&per_page=5`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      data?: { rows?: Array<{ id: string; name: string; slug: string }> };
    } | null;
    const rows = json?.data?.rows ?? [];
    const exact = rows.find((r) => r.slug === trimmed.toLowerCase());
    const first = exact ?? rows[0];
    return first ? { id: first.id, name: first.name } : null;
  }

  function run(action: 'suspend' | 'delete') {
    if (disabled) return;
    const slug = window.prompt(
      action === 'suspend'
        ? 'Suspend a landlord — enter their org slug (e.g. "nair-lettings"):'
        : 'Delete a landlord — enter their org slug. Org must already be suspended.',
    );
    if (!slug || !slug.trim()) return;

    setSubmitting(action);
    startTransition(async () => {
      try {
        const target = await lookupOrgId(slug);
        if (!target) {
          throw new Error(`No landlord found matching "${slug}"`);
        }
        const reason =
          action === 'delete'
            ? window.prompt(
                `Delete ${target.name}? Record a reason (audit trail):`,
                'Account closure requested',
              )
            : window.prompt(`Suspend ${target.name}? Optional reason:`, '');
        if (action === 'delete' && (!reason || reason.trim().length < 3)) {
          if (reason !== null) toast.error('Delete requires a reason of at least 3 characters');
          return;
        }
        const path = action === 'suspend' ? 'suspend' : 'delete';
        const body =
          action === 'suspend'
            ? { action: 'suspend', reason: reason?.trim() || undefined }
            : { reason: (reason ?? '').trim() };
        const res = await fetch(`/api/admin/orgs/${target.id}/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          throw new Error(json?.error?.message ?? `Could not ${action}`);
        }
        toast.success(action === 'suspend' ? `${target.name} suspended` : `${target.name} deleted`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not ${action}`);
      } finally {
        setSubmitting(null);
      }
    });
  }

  return (
    <Card className="border-alert/30 bg-alert-bg/30">
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-alert" aria-hidden="true" />
        <CardTitle className="text-alert">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-ink-light">
          Irreversible operations. Available to super admins only. All actions are written to the
          admin audit log.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-card border border-border-soft bg-white p-3.5">
            <div className="mb-1 flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <h3 className="font-semibold text-ink">Suspend a landlord</h3>
            </div>
            <p className="text-[12px] text-ink-light">
              Flips the subscription to <code className="rounded bg-bg-page px-1">canceled</code>{' '}
              and applies the free-tier override. Reversible via Reinstate.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => run('suspend')}
              disabled={disabled || pending || submitting !== null}
            >
              {submitting === 'suspend' ? '…' : 'Suspend by slug'}
            </Button>
          </div>
          <div className="rounded-card border border-alert/30 bg-white p-3.5">
            <div className="mb-1 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-alert" aria-hidden="true" />
              <h3 className="font-semibold text-alert">Permanently delete a landlord</h3>
            </div>
            <p className="text-[12px] text-ink-light">
              Soft-delete (sets <code className="rounded bg-bg-page px-1">deleted_at</code>). Org
              hides from default lists but tenancies remain. Restore via{' '}
              <code className="rounded bg-bg-page px-1">?show_deleted=1</code> on /admin/orgs.
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-3"
              onClick={() => run('delete')}
              disabled={disabled || pending || submitting !== null}
            >
              {submitting === 'delete' ? '…' : 'Delete by slug'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
