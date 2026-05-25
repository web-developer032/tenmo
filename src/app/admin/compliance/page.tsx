import { AlertCircle, AlertTriangle, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { redirect } from 'next/navigation';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AdminListQuery } from '@/core/schemas/admin';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { AdminBanner, AdminFilterRow, AdminTabBar } from '@/features/admin/components/ds';
import { FilterSelect } from '@/features/admin/components/filter-select';
import { NotifyLandlordButton } from '@/features/admin/components/notify-landlord-button';
import {
  getAdminSelf,
  hasAdminRole,
  type ListViolationsParams,
  listComplianceViolationsWithClient,
} from '@/features/admin/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    severity?: string;
    kind?: string;
    page?: string;
    per_page?: string;
  }>;
}

const KIND_LABEL: Record<string, string> = {
  gas_safety_expired: 'Gas safety',
  eicr_expired: 'EICR',
  hmo_licence_expired: 'HMO licence',
  epc_expired: 'EPC',
  deposit_unprotected: 'Deposit unprotected',
  right_to_rent_overdue: 'Right-to-Rent',
};

/**
 * /admin/compliance — platform-wide compliance violations.
 *
 * Aggregates expired/expiring certs, unprotected deposits and overdue
 * R2R re-checks via the `admin_compliance_violations` view. Critical
 * banner fires when at least one critical row is open.
 */
export default async function AdminCompliancePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/compliance');

  const self = await getAdminSelf(supabase, user.id);
  const canEdit = hasAdminRole(self, ['super', 'support']);

  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const severity = (sp.severity as ListViolationsParams['severity']) ?? 'all';
  const kind = sp.kind ?? 'all';

  const result = await listComplianceViolationsWithClient(supabase, {
    q: params.q ?? null,
    severity,
    kind,
    page: params.page,
    perPage: params.per_page,
  });

  const knownKinds = Object.keys(result.by_kind).sort();

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Compliance alerts' }]}
        title="Compliance alerts"
        description={
          <>
            {result.total} active alert{result.total === 1 ? '' : 's'} across every landlord.
          </>
        }
      />

      {result.critical_total > 0 ? (
        <AdminBanner
          tone="alert"
          title={`${result.critical_total} critical compliance issue${result.critical_total === 1 ? '' : 's'}`}
          description="Expired safety certificates and unprotected deposits expose landlords (and the platform) to legal risk. Use Alert landlord to send the templated reminder."
        />
      ) : null}

      <ResponsiveGrid preset="kpi">
        <KpiCard
          accent="red"
          icon={<AlertCircle />}
          label="Critical"
          value={result.critical_total.toString()}
          delta={result.critical_total > 0 ? { value: 'Now', tone: 'down' } : undefined}
        />
        <KpiCard
          accent="amber"
          icon={<AlertTriangle />}
          label="Warnings"
          value={result.warning_total.toString()}
          delta={result.warning_total > 0 ? { value: 'Watch', tone: 'warn' } : undefined}
        />
        <KpiCard
          accent="blue"
          icon={<ShieldQuestion />}
          label="Open kinds"
          value={Object.keys(result.by_kind).length.toString()}
          delta={{ value: 'Types', tone: 'info' }}
        />
        <KpiCard
          accent="forest"
          icon={<ShieldCheck />}
          label="Total tracked"
          value={result.total.toString()}
          delta={{ value: 'Live', tone: 'up' }}
        />
      </ResponsiveGrid>

      <AdminTabBar
        activeId={severity ?? 'all'}
        items={[
          {
            id: 'all',
            label: 'All',
            href: buildHref(undefined, kind, params.q),
            count: result.total,
          },
          {
            id: 'critical',
            label: 'Critical',
            href: buildHref('critical', kind, params.q),
            count: result.critical_total,
          },
          {
            id: 'warning',
            label: 'Warnings',
            href: buildHref('warning', kind, params.q),
            count: result.warning_total,
          },
        ]}
      />

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <AdminFilterRow>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <AdminSearchInput
                basePath="/admin/compliance"
                initialValue={params.q ?? ''}
                placeholder="Search landlord, subject or details…"
              />
            </div>
            <FilterSelect
              name="kind"
              value={kind}
              basePath="/admin/compliance"
              preserve={['q', 'severity']}
            >
              <option value="all">All kinds</option>
              {knownKinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </option>
              ))}
            </FilterSelect>
          </AdminFilterRow>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Kind</th>
                  <th className="px-3 py-2.5 font-bold">Subject</th>
                  <th className="px-3 py-2.5 font-bold">Landlord</th>
                  <th className="px-3 py-2.5 font-bold">Severity</th>
                  <th className="px-3 py-2.5 font-bold">Days outstanding</th>
                  <th className="px-3 py-2.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[13px] text-ink-light" colSpan={6}>
                      No compliance violations match this view.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-border-soft transition-colors last:border-b-0 hover:bg-foam/60"
                    >
                      <td className="px-3 py-3 font-semibold text-ink">
                        {KIND_LABEL[v.kind] ?? v.kind}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">{v.subject ?? '—'}</div>
                        {v.details ? (
                          <div className="text-[11.5px] text-ink-light">{v.details}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink">{v.landlord_name ?? '—'}</td>
                      <td className="px-3 py-3">
                        <SeverityPill severity={v.severity} />
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink">
                        {v.days_outstanding > 0 ? `${v.days_outstanding}d` : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <NotifyLandlordButton
                          orgId={v.org_id}
                          violationId={v.id}
                          kind={v.kind}
                          canEdit={canEdit}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 lg:hidden">
            {result.rows.length === 0 ? (
              <p className="text-[13px] text-ink-light">
                No compliance violations match this view.
              </p>
            ) : (
              result.rows.map((v) => (
                <div key={v.id} className="rounded-card border border-border-soft bg-white p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">
                        {KIND_LABEL[v.kind] ?? v.kind} · {v.subject ?? '—'}
                      </div>
                      <div className="text-[11.5px] text-ink-light">{v.landlord_name ?? '—'}</div>
                    </div>
                    <SeverityPill severity={v.severity} />
                  </div>
                  {v.details ? (
                    <div className="mt-2 text-[12px] text-ink-mid">{v.details}</div>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11.5px] text-ink-light">
                      {v.days_outstanding > 0 ? `${v.days_outstanding}d outstanding` : 'New'}
                    </span>
                    <NotifyLandlordButton
                      orgId={v.org_id}
                      violationId={v.id}
                      kind={v.kind}
                      canEdit={canEdit}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <AdminPagination
            basePath="/admin/compliance"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              severity: severity === 'all' ? undefined : (severity ?? undefined),
              kind: kind === 'all' ? undefined : kind,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function buildHref(
  severity: string | undefined,
  kind: string | null | undefined,
  q: string | null | undefined,
): string {
  const sp = new URLSearchParams();
  if (severity && severity !== 'all') sp.set('severity', severity);
  if (kind && kind !== 'all') sp.set('kind', kind);
  if (q) sp.set('q', q);
  const s = sp.toString();
  return s ? `/admin/compliance?${s}` : '/admin/compliance';
}

function SeverityPill({ severity }: { severity: string }) {
  if (severity === 'critical') return <Badge variant="urgent">Critical</Badge>;
  if (severity === 'warning') return <Badge variant="warning">Warning</Badge>;
  return <Badge variant="info">{severity}</Badge>;
}
