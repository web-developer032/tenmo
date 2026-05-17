import Link from 'next/link';
import { ADMIN_EVENT_LABEL, ADMIN_EVENT_TONE } from '@/core/constants/admin';
import type { AdminAuditEntry } from '@/core/schemas/admin';
import { cn } from '@/lib/cn';

/**
 * Single row in an admin audit table. Server-rendered; deep-links
 * to the related user / org when those targets are set.
 */
export function AuditRow({ row }: { row: AdminAuditEntry }) {
  const when = formatDateTime(row.created_at);
  const summary = summarisePayload(row);

  return (
    <tr className="border-b text-sm last:border-b-0 hover:bg-muted/40">
      <td className="px-3 py-2 align-top">
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
            ADMIN_EVENT_TONE[row.event],
          )}
        >
          {ADMIN_EVENT_LABEL[row.event]}
        </span>
      </td>
      <td className="px-3 py-2 align-top text-muted-foreground">{when}</td>
      <td className="px-3 py-2 align-top">
        {row.target_user_id ? (
          <Link
            href={`/admin/users/${row.target_user_id}`}
            className="font-mono text-xs text-primary hover:underline"
          >
            user · {row.target_user_id.slice(0, 8)}
          </Link>
        ) : null}
        {row.target_org_id ? (
          <Link
            href={`/admin/orgs/${row.target_org_id}`}
            className="ml-2 font-mono text-xs text-primary hover:underline"
          >
            org · {row.target_org_id.slice(0, 8)}
          </Link>
        ) : null}
        {!row.target_user_id && !row.target_org_id ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top">
        <span className="font-mono text-xs text-muted-foreground">
          {row.actor_user_id.slice(0, 8)}
        </span>
      </td>
      <td className="px-3 py-2 align-top text-xs text-muted-foreground">{summary}</td>
    </tr>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function summarisePayload(row: AdminAuditEntry): string {
  if (!row.payload) return '';
  const p = row.payload as Record<string, unknown>;
  if (row.event === 'subscription_override_set') {
    const next = (p.next as { override_tier?: string } | undefined)?.override_tier;
    return next ? `→ ${next}` : '';
  }
  if (row.event === 'subscription_override_cleared') {
    return 'override removed';
  }
  if (row.event === 'support_note' && typeof p.note === 'string') {
    return (p.note as string).slice(0, 80);
  }
  return '';
}
