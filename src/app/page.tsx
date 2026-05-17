import { ArrowRight, Building2, KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dispatch');

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Tenantly
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            UK HMO management, built for the Renters&apos; Rights Bill
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Run your HMO at the room level — and let your tenants ride free.
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Compliance, rent, tenants, paperwork — all in one place. Landlords pay a flat
            subscription. Tenants are free, forever.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <Building2 className="h-6 w-6 text-primary" />
              <CardTitle>Rooms, not just properties</CardTitle>
              <CardDescription>
                HMOs work room-by-room. Tenantly does too — independent rent, status, tenancies and
                bills per room.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <ShieldCheck className="h-6 w-6 text-primary" />
              <CardTitle>Compliance on autopilot</CardTitle>
              <CardDescription>
                Gas, EICR, EPC, FRA, RTR and HMO licences tracked with traffic lights and automatic
                60/30/7-day reminders.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <KeyRound className="h-6 w-6 text-primary" />
              <CardTitle>Tenants free forever</CardTitle>
              <CardDescription>
                Rent dashboard, messaging, repairs and Rental Passport — never a fee for the tenant.
                Locked into the product DNA.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="mx-auto max-w-6xl px-6 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Tenantly. UK-first HMO management.
        </div>
      </footer>
    </main>
  );
}
