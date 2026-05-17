import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AdminListQuery } from '@/core/schemas/admin';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AdminPagination } from '@/features/admin/components/admin-pagination';
import { AdminSearchInput } from '@/features/admin/components/admin-search-input';
import { loadAdminUsers } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; per_page?: string }>;
}

/**
 * /admin/users — paginated list of every profile on the platform.
 * Free-text search across name / email / phone.
 */
export default async function AdminUsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = AdminListQuery.parse({
    q: sp.q,
    page: sp.page,
    per_page: sp.per_page,
  });
  const result = await loadAdminUsers({
    q: params.q ?? null,
    page: params.page,
    perPage: params.per_page,
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Users</h1>
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString('en-GB')} total profile
          {result.total === 1 ? '' : 's'}.
        </p>
      </header>

      <AdminNav />

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <AdminSearchInput
            basePath="/admin/users"
            initialValue={params.q ?? ''}
            placeholder="Search by name, email or phone…"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground text-sm" colSpan={5}>
                      No users match this search.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((u) => (
                    <tr key={u.id} className="border-b text-sm last:border-b-0 hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          {u.full_name ?? u.preferred_name ?? '(no name)'}
                          {u.is_admin ? (
                            <span
                              className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                              title="Platform admin"
                            >
                              <ShieldCheck className="h-3 w-3" /> admin
                            </span>
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{u.contact_email ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.contact_phone ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/users/${u.id}`}
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
            basePath="/admin/users"
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
