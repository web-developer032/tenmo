import { AlertCircle, MailCheck, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { AvRow } from '@/components/ds/av-row';
import { KpiCard } from '@/components/ds/kpi-card';
import { PageHeader } from '@/components/ds/page-header';
import { ResponsiveGrid } from '@/components/ds/responsive-grid';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AdminListQuery } from '@/core/schemas/admin';
import { formatMoney } from '@/core/utils/money';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { AdminFilterRow } from '@/features/admin/components/ds';
import { FilterSelect } from '@/features/admin/components/filter-select';
import { loadAdminTenants } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    portal?: string;
    sort?: string;
    page?: string;
    per_page?: string;
  }>;
}

/**
 * /admin/tenants — full read of every tenancy on the platform, with
 * KPI strip and filter row driving the underlying
 * `admin_tenant_summary` view.
 */
export default async function AdminTenantsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const status = sp.status ?? 'all';
  const portal = sp.portal ?? 'all';
  const sort = (sp.sort as 'newest' | 'rent' | 'landlord') ?? 'newest';

  const result = await loadAdminTenants({
    q: params.q ?? null,
    status: status === 'all' ? null : status,
    portal: portal === 'all' ? null : portal,
    sort,
    page: params.page,
    perPage: params.per_page,
  });

  const activeCount = result.rows.filter((r) => r.tenancy_status === 'active').length;
  const invitedCount = result.rows.filter((r) => r.portal_status === 'invited').length;
  const arrearsCount = result.rows.filter((r) => r.tenancy_status === 'ended').length;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Tenants' }]}
        title="Tenants"
        description={
          <>
            {result.total.toLocaleString('en-GB')} tenancy
            {result.total === 1 ? '' : 'ies'} across the platform.
          </>
        }
      />

      <ResponsiveGrid preset="kpi">
        <KpiCard
          accent="forest"
          label="Active tenants"
          value={activeCount.toLocaleString('en-GB')}
          icon={<Users />}
        />
        <KpiCard
          accent="blue"
          label="Invited (pending)"
          value={invitedCount.toLocaleString('en-GB')}
          icon={<MailCheck />}
        />
        <KpiCard
          accent="amber"
          label="Ended / off-boarded"
          value={arrearsCount.toLocaleString('en-GB')}
          icon={<UserCheck />}
        />
        <KpiCard
          accent="red"
          label="No portal access"
          value={result.rows
            .filter((r) => r.portal_status !== 'active' && r.tenancy_status === 'active')
            .length.toLocaleString('en-GB')}
          icon={<AlertCircle />}
        />
      </ResponsiveGrid>

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <AdminFilterRow>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <AdminSearchInput
                basePath="/admin/tenants"
                initialValue={params.q ?? ''}
                placeholder="Search tenant, landlord or property…"
              />
            </div>
            <FilterSelect
              name="status"
              value={status}
              basePath="/admin/tenants"
              preserve={['q', 'portal', 'sort']}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending_invite">Pending invite</option>
              <option value="awaiting_signature">Awaiting signature</option>
              <option value="ended">Ended</option>
              <option value="cancelled">Cancelled</option>
            </FilterSelect>
            <FilterSelect
              name="portal"
              value={portal}
              basePath="/admin/tenants"
              preserve={['q', 'status', 'sort']}
            >
              <option value="all">Any portal state</option>
              <option value="active">Portal active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
            </FilterSelect>
            <FilterSelect
              name="sort"
              value={sort}
              basePath="/admin/tenants"
              preserve={['q', 'status', 'portal']}
            >
              <option value="newest">Sort: Newest</option>
              <option value="rent">Sort: Rent ↓</option>
              <option value="landlord">Sort: Landlord A–Z</option>
            </FilterSelect>
          </AdminFilterRow>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Tenant</th>
                  <th className="px-3 py-2.5 font-bold">Landlord</th>
                  <th className="px-3 py-2.5 font-bold">Property / room</th>
                  <th className="px-3 py-2.5 font-bold">Rent</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Portal</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[13px] text-ink-light" colSpan={6}>
                      No tenancies match this filter.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((t) => (
                    <tr
                      key={t.tenancy_id}
                      className="border-b border-border-soft transition-colors last:border-b-0 hover:bg-foam/60"
                    >
                      <td className="px-3 py-3">
                        <AvRow
                          size="sm"
                          name={t.tenant_name ?? 'Pending invite'}
                          sub={t.tenant_email ?? '—'}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/orgs/${t.org_id}`}
                          className="font-semibold text-ink hover:text-forest-600 hover:underline"
                        >
                          {t.landlord_name ?? t.org_name}
                        </Link>
                        <div className="text-[11px] text-ink-light">{t.org_name}</div>
                      </td>
                      <td className="px-3 py-3 text-ink">
                        {(t.property_address?.line1 as string | undefined) ?? '—'}
                        {t.room_name ? (
                          <div className="text-[11px] text-ink-light">{t.room_name}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-ink">
                        {formatMoney(t.rent_pence)}
                        <span className="ml-1 text-[11px] text-ink-light">
                          /{rentFreq(t.rent_frequency)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={t.tenancy_status} />
                      </td>
                      <td className="px-3 py-3">
                        <PortalPill portal={t.portal_status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 lg:hidden">
            {result.rows.length === 0 ? (
              <p className="text-[13px] text-ink-light">No tenancies match this filter.</p>
            ) : (
              result.rows.map((t) => (
                <Link
                  key={t.tenancy_id}
                  href={`/admin/orgs/${t.org_id}`}
                  className="rounded-card border border-border-soft bg-white p-3.5 transition-colors hover:bg-foam/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <AvRow size="sm" name={t.tenant_name ?? 'Pending invite'} sub={t.org_name} />
                    <div className="text-right">
                      <div className="font-semibold text-ink">{formatMoney(t.rent_pence)}</div>
                      <StatusPill status={t.tenancy_status} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <AdminPagination
            basePath="/admin/tenants"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              status: status === 'all' ? undefined : status,
              portal: portal === 'all' ? undefined : portal,
              sort: sort === 'newest' ? undefined : sort,
              per_page: params.per_page === 25 ? undefined : String(params.per_page),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="active">Active</Badge>;
  if (status === 'pending_invite') return <Badge variant="warning">Pending</Badge>;
  if (status === 'awaiting_signature') return <Badge variant="warning">Awaiting AST</Badge>;
  if (status === 'awaiting_deposit') return <Badge variant="warning">Awaiting deposit</Badge>;
  if (status === 'ended') return <Badge variant="neutral">Ended</Badge>;
  if (status === 'cancelled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function PortalPill({ portal }: { portal: string }) {
  if (portal === 'active') return <Badge variant="active">Active</Badge>;
  if (portal === 'invited') return <Badge variant="info">Invited</Badge>;
  return <Badge variant="neutral">Inactive</Badge>;
}

function rentFreq(freq: string): string {
  if (freq === 'monthly') return 'mo';
  if (freq === 'weekly') return 'wk';
  return freq;
}
