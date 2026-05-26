import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AvRow } from '@/components/ds/av-row';
import { PageHeader } from '@/components/ds/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/core/constants/billing';
import { AdminListQuery } from '@/core/schemas/admin';
import { formatMoney } from '@/core/utils/money';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { AdminFilterRow } from '@/features/admin/components/ds';
import { buildExportQuery, ExportCsvLink } from '@/features/admin/components/export-csv-link';
import { FilterSelect } from '@/features/admin/components/filter-select';
import { ImpersonateButton } from '@/features/admin/components/impersonate-button';
import { InviteLandlordDialog } from '@/features/admin/components/invite-landlord-dialog';
import { LandlordDeleteButton } from '@/features/admin/components/landlord-delete-button';
import { LandlordSuspendButton } from '@/features/admin/components/landlord-suspend-button';
import { loadAdminLandlords } from '@/features/admin/loaders';
import { getAdminSelf } from '@/features/admin/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tier?: string;
    status?: string;
    sort?: string;
    page?: string;
    per_page?: string;
    show_deleted?: string;
  }>;
}

/**
 * /admin/orgs — Landlords list.
 *
 * Powered by the `admin_org_summary` view: shows owner, plan,
 * properties, tenants, MRR, joined date and status with row-level
 * Impersonate / Suspend / Reinstate actions.
 */
export default async function AdminLandlordsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const tier = sp.tier ?? 'all';
  const status = sp.status ?? 'all';
  const sort = (sp.sort as 'newest' | 'mrr' | 'properties' | 'name') ?? 'newest';
  const showDeleted = sp.show_deleted === '1';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/orgs');
  const self = await getAdminSelf(supabase, user.id);
  const isSuper = self.role === 'super';

  const result = await loadAdminLandlords({
    q: params.q ?? null,
    tier: tier === 'all' ? null : tier,
    status: status === 'all' ? null : status,
    sort,
    page: params.page,
    perPage: params.per_page,
    showDeleted,
  });

  const trialCount = result.rows.filter((r) => r.status === 'trialing').length;

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Landlords' }]}
        title="Landlords"
        description={
          <>
            {result.total.toLocaleString('en-GB')} landlord
            {result.total === 1 ? '' : 's'}
            {trialCount > 0 ? ` · ${trialCount} on trial in this view` : ''}.
          </>
        }
        actions={
          <>
            <InviteLandlordDialog />
            <ExportCsvLink
              href={`/api/admin/orgs/export.csv${buildExportQuery({
                q: params.q,
                tier,
                status,
                sort,
                show_deleted: showDeleted ? '1' : undefined,
              })}`}
            />
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4 lg:p-5">
          <AdminFilterRow>
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <AdminSearchInput
                basePath="/admin/orgs"
                initialValue={params.q ?? ''}
                placeholder="Search by name, email or company…"
              />
            </div>
            <FilterSelect
              name="tier"
              value={tier}
              basePath="/admin/orgs"
              preserve={['q', 'status', 'sort']}
            >
              <option value="all">All plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="portfolio">Growth / Portfolio</option>
              <option value="trial">On trial</option>
            </FilterSelect>
            <FilterSelect
              name="status"
              value={status}
              basePath="/admin/orgs"
              preserve={['q', 'tier', 'sort']}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trial</option>
              <option value="past_due">Payment failed</option>
              <option value="canceled">Suspended</option>
            </FilterSelect>
            <FilterSelect
              name="sort"
              value={sort}
              basePath="/admin/orgs"
              preserve={['q', 'tier', 'status']}
            >
              <option value="newest">Sort: Newest</option>
              <option value="mrr">Sort: MRR ↓</option>
              <option value="properties">Sort: Properties ↓</option>
              <option value="name">Sort: Name A–Z</option>
            </FilterSelect>
            <Link
              href={
                showDeleted
                  ? buildOrgsHref({ q: params.q, tier, status, sort })
                  : buildOrgsHref({ q: params.q, tier, status, sort, showDeleted: true })
              }
              className={`inline-flex h-9 items-center rounded-button border px-3 text-[12.5px] font-semibold transition-colors ${
                showDeleted
                  ? 'border-alert/40 bg-alert-bg text-alert hover:bg-alert-bg/80'
                  : 'border-border-soft bg-white text-ink-mid hover:bg-foam hover:text-forest-700'
              }`}
            >
              {showDeleted ? 'Hiding live landlords' : 'Show deleted'}
            </Link>
          </AdminFilterRow>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-page text-left text-[11px] font-bold uppercase tracking-wider text-ink-light">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Landlord</th>
                  <th className="px-3 py-2.5 font-bold">Plan</th>
                  <th className="px-3 py-2.5 font-bold">Properties</th>
                  <th className="px-3 py-2.5 font-bold">Tenants</th>
                  <th className="px-3 py-2.5 font-bold">MRR</th>
                  <th className="px-3 py-2.5 font-bold">Joined</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[13px] text-ink-light" colSpan={8}>
                      No landlords match this filter.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((o) => (
                    <tr
                      key={o.org_id}
                      className="border-b border-border-soft transition-colors last:border-b-0 hover:bg-foam/60"
                    >
                      <td className="px-3 py-3">
                        <AvRow
                          size="sm"
                          name={o.owner_name ?? o.name}
                          sub={
                            <span>
                              {o.name}
                              {o.owner_email ? ` · ${o.owner_email}` : ''}
                            </span>
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <TierPill tier={o.tier} mrrPence={o.mrr_pence} />
                      </td>
                      <td className="px-3 py-3 text-ink">{o.property_count}</td>
                      <td className="px-3 py-3 text-ink">{o.active_tenancy_count}</td>
                      <td className="px-3 py-3 text-ink">
                        {o.mrr_pence > 0 ? formatMoney(o.mrr_pence) : '—'}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-ink-light">
                        {formatJoined(o.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/orgs/${o.org_id}`}
                            className="rounded-button border border-border-soft bg-white px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-foam hover:text-forest-700"
                          >
                            Open
                          </Link>
                          {o.deleted_at ? null : (
                            <ImpersonateButton
                              targetUserId={o.owner_user_id}
                              targetLabel={o.owner_name ?? o.name}
                              disabled={!isSuper || !o.owner_user_id}
                              disabledReason={
                                !isSuper
                                  ? 'Super admin only'
                                  : !o.owner_user_id
                                    ? 'Org has no owner user'
                                    : undefined
                              }
                            />
                          )}
                          {!o.deleted_at && (
                            <LandlordSuspendButton
                              orgId={o.org_id}
                              isSuspended={o.status === 'canceled'}
                            />
                          )}
                          <LandlordDeleteButton
                            orgId={o.org_id}
                            orgName={o.name}
                            isDeleted={Boolean(o.deleted_at)}
                            canDelete={isSuper && o.status === 'canceled'}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card stack */}
          <div className="flex flex-col gap-2 lg:hidden">
            {result.rows.length === 0 ? (
              <p className="text-[13px] text-ink-light">No landlords match this filter.</p>
            ) : (
              result.rows.map((o) => (
                <Link
                  key={o.org_id}
                  href={`/admin/orgs/${o.org_id}`}
                  className="rounded-card border border-border-soft bg-white p-3.5 transition-colors hover:bg-foam/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <AvRow
                      size="sm"
                      name={o.owner_name ?? o.name}
                      sub={
                        <span>
                          {o.name} · {o.property_count} prop · {o.active_tenancy_count} tenants
                        </span>
                      }
                    />
                    <div className="text-right">
                      <TierPill tier={o.tier} mrrPence={o.mrr_pence} />
                      <div className="mt-1">
                        <StatusPill status={o.status} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <AdminPagination
            basePath="/admin/orgs"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              tier: tier === 'all' ? undefined : tier,
              status: status === 'all' ? undefined : status,
              sort: sort === 'newest' ? undefined : sort,
              per_page: params.per_page === 25 ? undefined : String(params.per_page),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TierPill({ tier, mrrPence }: { tier: string | null; mrrPence: number }) {
  if (!tier || tier === 'free') return <Badge variant="neutral">Free</Badge>;
  // 'portfolio' tier is sold as both "Growth" (~£59/mo) and "Enterprise"
  // (custom pricing). Differentiate visually by MRR.
  if (tier === 'portfolio') {
    if (mrrPence >= 10_000) {
      return <Badge variant="purple">Enterprise</Badge>;
    }
    return <Badge variant="success">Growth</Badge>;
  }
  const label = SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS]?.name ?? tier;
  if (tier === 'pro') return <Badge variant="success">{label}</Badge>;
  return <Badge variant="neutral">{label}</Badge>;
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === 'active') return <Badge variant="active">Active</Badge>;
  if (status === 'trialing') return <Badge variant="warning">Trial</Badge>;
  if (status === 'past_due' || status === 'unpaid') return <Badge variant="overdue">Failed</Badge>;
  if (status === 'canceled') return <Badge variant="urgent">Suspended</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function buildOrgsHref({
  q,
  tier,
  status,
  sort,
  showDeleted,
}: {
  q?: string | null;
  tier: string;
  status: string;
  sort: string;
  showDeleted?: boolean;
}): string {
  const usp = new URLSearchParams();
  if (q) usp.set('q', q);
  if (tier && tier !== 'all') usp.set('tier', tier);
  if (status && status !== 'all') usp.set('status', status);
  if (sort && sort !== 'newest') usp.set('sort', sort);
  if (showDeleted) usp.set('show_deleted', '1');
  const qs = usp.toString();
  return qs ? `/admin/orgs?${qs}` : '/admin/orgs';
}

function formatJoined(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}
