import { PageHeader } from '@/components/ds/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  ADMIN_EVENT_KIND_VALUES,
  ADMIN_EVENT_LABEL,
  type AdminEventKind,
} from '@/core/constants/admin';
import { AdminListQuery } from '@/core/schemas/admin';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { AuditRow } from '@/features/admin/components/audit-row';
import { AdminFilterRow } from '@/features/admin/components/ds';
import { buildExportQuery, ExportCsvLink } from '@/features/admin/components/export-csv-link';
import { FilterSelect } from '@/features/admin/components/filter-select';
import { loadAdminAudit } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    event?: string;
    actor?: string;
    range?: string;
    target_user_id?: string;
    target_org_id?: string;
    page?: string;
    per_page?: string;
  }>;
}

const RANGE_OPTIONS = [
  { value: '24h', label: 'Last 24 hours', days: 1 },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null as number | null },
] as const;

/**
 * /admin/audit — full read of `admin_audit_log` with the new
 * HMOeez-style filter row (range / search / actor / action). Each
 * row shows actor avatar + role + IP + result alongside the event
 * and target deep-links.
 */
export default async function AdminAuditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });

  const event: AdminEventKind | null =
    sp.event && (ADMIN_EVENT_KIND_VALUES as string[]).includes(sp.event)
      ? (sp.event as AdminEventKind)
      : null;
  const actorUserId = sp.actor && sp.actor !== 'all' ? sp.actor : null;
  const range = (sp.range as (typeof RANGE_OPTIONS)[number]['value']) ?? '30d';
  const days = RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 30;
  const since = days ? new Date(Date.now() - days * 86_400_000) : null;

  const result = await loadAdminAudit({
    page: params.page,
    perPage: params.per_page,
    event,
    actorUserId,
    targetUserId: sp.target_user_id ?? null,
    targetOrgId: sp.target_org_id ?? null,
    search: params.q ?? null,
    since,
  });

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Audit log' }]}
        title="Audit log"
        description={
          <>
            {result.total.toLocaleString('en-GB')} matching event
            {result.total === 1 ? '' : 's'} in the selected range.
          </>
        }
        actions={
          <ExportCsvLink
            href={`/api/admin/audit/export.csv${buildExportQuery({
              q: params.q,
              event,
              actor_user_id: actorUserId,
              target_org_id: sp.target_org_id,
              target_user_id: sp.target_user_id,
              since: since ? since.toISOString() : undefined,
            })}`}
          />
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <AdminFilterRow>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <AdminSearchInput
                basePath="/admin/audit"
                initialValue={params.q ?? ''}
                placeholder="Search event, actor or target id…"
              />
            </div>
            <FilterSelect
              name="range"
              value={range}
              basePath="/admin/audit"
              preserve={['q', 'event', 'actor']}
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              name="actor"
              value={actorUserId ?? 'all'}
              basePath="/admin/audit"
              preserve={['q', 'event', 'range']}
            >
              <option value="all">Actor: all</option>
              <option value="system">System (automated)</option>
              {result.actor_options.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.full_name ?? a.contact_email ?? a.user_id.slice(0, 8)}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              name="event"
              value={event ?? 'all'}
              basePath="/admin/audit"
              preserve={['q', 'actor', 'range']}
            >
              <option value="all">All actions</option>
              {ADMIN_EVENT_KIND_VALUES.map((k) => (
                <option key={k} value={k}>
                  {ADMIN_EVENT_LABEL[k]}
                </option>
              ))}
            </FilterSelect>
          </AdminFilterRow>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
                <tr>
                  <th className="px-3 py-2.5 font-bold">When</th>
                  <th className="px-3 py-2.5 font-bold">Actor</th>
                  <th className="px-3 py-2.5 font-bold">Role</th>
                  <th className="px-3 py-2.5 font-bold">Action</th>
                  <th className="px-3 py-2.5 font-bold">Target</th>
                  <th className="px-3 py-2.5 font-bold">IP</th>
                  <th className="px-3 py-2.5 font-bold">Result</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[13px] text-ink-light" colSpan={7}>
                      No audit events match this filter.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((row) => <AuditRow key={row.id} row={row} />)
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath="/admin/audit"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              event: event ?? undefined,
              actor: actorUserId ?? undefined,
              range: range === '30d' ? undefined : range,
              target_user_id: sp.target_user_id,
              target_org_id: sp.target_org_id,
              per_page: params.per_page === 25 ? undefined : String(params.per_page),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
