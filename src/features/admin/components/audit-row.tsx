import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ADMIN_EVENT_LABEL, ADMIN_EVENT_TONE } from '@/core/constants/admin';
import type { AdminAuditEntry } from '@/core/schemas/admin';
import { ROLE_LABEL } from '@/features/admin/data/role-permissions';
import type { AdminRole } from '@/features/admin/server';
import { cn } from '@/lib/cn';

export type AuditRowData = AdminAuditEntry & {
  actor_name: string | null;
  actor_email: string | null;
  actor_role: AdminRole | null;
};

/**
 * Single row in the admin audit table.
 *
 * Renders the actor avatar (initials), the role badge, the event
 * pill, the target deep-links, IP (if recorded in the payload) and a
 * one-line summary of the JSON payload. Server-rendered.
 */
export function AuditRow({ row }: { row: AuditRowData }) {
  const when = formatDateTime(row.created_at);
  const summary = summarisePayload(row);
  const ip = extractIp(row);
  const initials = initialsFromName(row.actor_name ?? row.actor_email ?? row.actor_user_id);

  return (
    <tr className="border-b border-border-soft text-[13px] last:border-b-0 transition-colors hover:bg-foam/60">
      <td className="px-3 py-3 align-top text-[12px] text-ink-light whitespace-nowrap">{when}</td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-100 text-[11px] font-bold text-forest-700">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{row.actor_name ?? 'Admin'}</div>
            <div className="truncate text-[11px] text-ink-light">{row.actor_email ?? '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        {row.actor_role ? (
          <Badge variant={roleVariant(row.actor_role)} className="capitalize">
            {ROLE_LABEL[row.actor_role]}
          </Badge>
        ) : (
          <span className="text-[11px] text-ink-light">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            ADMIN_EVENT_TONE[row.event],
          )}
        >
          {ADMIN_EVENT_LABEL[row.event]}
        </span>
        {summary ? <div className="mt-1 text-[11.5px] text-ink-mid">{summary}</div> : null}
      </td>
      <td className="px-3 py-3 align-top">
        {row.target_user_id ? (
          <Link
            href={`/admin/users/${row.target_user_id}`}
            className="block font-mono text-[11px] text-forest-700 hover:underline"
          >
            user · {row.target_user_id.slice(0, 8)}
          </Link>
        ) : null}
        {row.target_org_id ? (
          <Link
            href={`/admin/orgs/${row.target_org_id}`}
            className="block font-mono text-[11px] text-forest-700 hover:underline"
          >
            org · {row.target_org_id.slice(0, 8)}
          </Link>
        ) : null}
        {!row.target_user_id && !row.target_org_id ? (
          <span className="text-[11px] text-ink-light">—</span>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top">
        <span className="font-mono text-[11px] text-ink-light">{ip ?? '—'}</span>
      </td>
      <td className="px-3 py-3 align-top">
        <Badge variant="success">Success</Badge>
      </td>
    </tr>
  );
}

function roleVariant(role: AdminRole): 'success' | 'info' | 'purple' | 'neutral' {
  if (role === 'super') return 'success';
  if (role === 'support') return 'info';
  if (role === 'finance') return 'purple';
  return 'neutral';
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function initialsFromName(s: string): string {
  if (!s) return '??';
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return s.slice(0, 2).toUpperCase();
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const second = parts[1] ?? '';
  return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase();
}

function extractIp(row: AdminAuditEntry): string | null {
  if (!row.payload || typeof row.payload !== 'object') return null;
  const p = row.payload as Record<string, unknown>;
  const v = p.ip ?? p.ip_address ?? p.remote_addr;
  return typeof v === 'string' ? v : null;
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
  if (typeof p.email === 'string') return p.email as string;
  if (typeof p.recipient === 'string') return p.recipient as string;
  return '';
}
