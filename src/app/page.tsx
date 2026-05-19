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
    <main className="min-h-dvh bg-bg-page text-ink">
      <header className="sticky top-0 z-20 border-b border-border-soft bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-sans text-lg font-extrabold tracking-tight text-ink"
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-forest-600 text-white"
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <title>Tenantly logo</title>
                <path d="M3 11l9-8 9 8" />
                <path d="M5 10v10h14V10" />
                <path d="M10 20v-6h4v6" />
              </svg>
            </span>
            Tenantly
          </Link>
          <nav className="flex items-center gap-1.5 lg:gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/listings">Find a room</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-24">
        <div className="max-w-3xl space-y-5 lg:space-y-6">
          <p className="text-[12px] font-bold uppercase tracking-wider text-forest-600">
            UK HMO management, built for the Renters&apos; Rights Bill
          </p>
          <h1 className="font-sans text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-6xl">
            Run your HMO at the room level — and let your tenants ride free.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-mid lg:text-lg">
            Compliance, rent, tenants, paperwork — all in one place. Landlords pay a flat
            subscription. Tenants are free, forever.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-6 lg:pb-24">
        <div className="grid gap-4 md:grid-cols-3 lg:gap-5">
          <Card>
            <CardHeader className="flex-col items-stretch gap-2">
              <Building2 className="h-6 w-6 text-forest-600" />
              <CardTitle>Rooms, not just properties</CardTitle>
              <CardDescription>
                HMOs work room-by-room. Tenantly does too — independent rent, status, tenancies and
                bills per room.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="flex-col items-stretch gap-2">
              <ShieldCheck className="h-6 w-6 text-forest-600" />
              <CardTitle>Compliance on autopilot</CardTitle>
              <CardDescription>
                Gas, EICR, EPC, FRA, RTR and HMO licences tracked with traffic lights and automatic
                60/30/7-day reminders.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="flex-col items-stretch gap-2">
              <KeyRound className="h-6 w-6 text-forest-600" />
              <CardTitle>Tenants free forever</CardTitle>
              <CardDescription>
                Rent dashboard, messaging, repairs and Rental Passport — never a fee for the tenant.
                Locked into the product DNA.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border-soft bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-[12.5px] text-ink-light lg:px-6">
          <span>&copy; {new Date().getFullYear()} Tenantly. UK-first HMO management.</span>
          <Link
            href="/listings"
            className="font-semibold text-forest-600 underline-offset-4 hover:underline"
          >
            Browse public listings →
          </Link>
        </div>
      </footer>
    </main>
  );
}
