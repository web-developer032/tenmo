import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AdminListQuery } from '@/core/schemas/admin';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { StatusBadge, TierBadge } from '@/features/admin/components/subscription-badges';
import { loadAdminOrgs } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; per_page?: string }>;
}

/**
 * /admin/orgs — paginated org list with subscription badges.
 */
export default async function AdminOrgsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const result = await loadAdminOrgs({
    q: params.q ?? null,
    page: params.page,
    perPage: params.per_page,
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Organisations</h1>
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString('en-GB')} total org
          {result.total === 1 ? '' : 's'}.
        </p>
      </header>

      <AdminNav />

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <AdminSearchInput
            basePath="/admin/orgs"
            initialValue={params.q ?? ''}
            placeholder="Search by name, slug or contact email…"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground text-sm" colSpan={6}>
                      No organisations match this search.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((o) => (
                    <tr key={o.id} className="border-b text-sm last:border-b-0 hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/admin/orgs/${o.id}`} className="font-medium hover:underline">
                          {o.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground text-xs">
                        {o.slug}
                      </td>
                      <td className="px-3 py-2">
                        <TierBadge tier={o.override_tier ?? o.tier} override={!!o.override_tier} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/orgs/${o.id}`}
                          className="text-primary text-xs hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath="/admin/orgs"
            page={result.page}
            totalPages={result.total_pages}
            preservedParams={{
              q: params.q,
              per_page: params.per_page === 25 ? undefined : String(params.per_page),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
