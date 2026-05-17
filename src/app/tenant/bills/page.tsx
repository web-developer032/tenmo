import { ArrowLeft, Receipt } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TenantBillsCard } from '@/features/bills/components/tenant-bills-card';
import { loadBillsForTenancy, type TenantBillRow } from '@/features/bills/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Tenant bills page — shows shared utility bills for every active
 * tenancy the user has, grouped by tenancy/property.
 */
export default async function TenantBillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/tenant/bills');

  const { data: tenancies } = await supabase
    .from('tenancies')
    .select(
      `id, status,
       properties:property_id ( name ),
       rooms:room_id ( name )`,
    )
    .eq('tenant_user_id', user.id)
    .in('status', ['active', 'awaiting_signature', 'awaiting_deposit']);

  const list = tenancies ?? [];

  const billsByTenancy = new Map<string, TenantBillRow[]>();
  await Promise.all(
    list.map(async (t) => {
      try {
        billsByTenancy.set(t.id, await loadBillsForTenancy(t.id));
      } catch {
        billsByTenancy.set(t.id, []);
      }
    }),
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/tenant">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to your home
        </Link>
      </Button>

      <header className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your shared bills</h1>
      </header>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no active tenancies, so there are no bills to show.
        </p>
      ) : (
        list.map((t) => {
          const property = pickFirst<{ name: string }>(t.properties);
          const room = pickFirst<{ name: string }>(t.rooms);
          return (
            <section key={t.id} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {property?.name ?? 'Property'}
                {room?.name ? ` — ${room.name}` : ''}
              </h2>
              <TenantBillsCard bills={billsByTenancy.get(t.id) ?? []} />
            </section>
          );
        })
      )}
    </div>
  );
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
