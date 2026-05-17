import { Activity, Building2, ClipboardList, CreditCard, ShieldAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminNav } from '@/features/admin/components/admin-nav';
import { AuditRow } from '@/features/admin/components/audit-row';
import { loadAdminDashboardStats } from '@/features/admin/loaders';

export const dynamic = 'force-dynamic';

/**
 * /admin — KPI tiles + the most recent admin audit entries. The
 * `/admin` layout has already enforced admin-only access, so we
 * just load and render here.
 */
export default async function AdminDashboardPage() {
  const stats = await loadAdminDashboardStats();
  const { counts, recent_activity } = stats;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Admin console</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Internal tools for support and operations. Every action you take here is recorded — see
          the audit log.
        </p>
      </header>

      <AdminNav />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<Users className="h-4 w-4" />} label="Users" value={counts.users} />
        <Stat icon={<Building2 className="h-4 w-4" />} label="Organisations" value={counts.orgs} />
        <Stat
          icon={<Activity className="h-4 w-4" />}
          label="Active tenancies"
          value={counts.active_tenancies}
        />
        <Stat
          icon={<CreditCard className="h-4 w-4" />}
          label="Paid subscriptions"
          value={counts.paid_subscriptions}
        />
        <Stat
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Active overrides"
          value={counts.overrides_active}
          tone={counts.overrides_active > 0 ? 'warn' : 'default'}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent admin activity</CardTitle>
            <CardDescription>Last 20 events across the platform.</CardDescription>
          </div>
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
          >
            <ClipboardList className="h-4 w-4" /> View full log
          </Link>
        </CardHeader>
        <CardContent>
          {recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-left text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_activity.map((row) => (
                    <AuditRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'default' | 'warn';
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wide">
          <span>{label}</span>
          <span>{icon}</span>
        </div>
        <p
          className={`font-semibold text-2xl ${
            tone === 'warn' && value > 0 ? 'text-amber-600 dark:text-amber-400' : ''
          }`}
        >
          {value.toLocaleString('en-GB')}
        </p>
      </CardContent>
    </Card>
  );
}
