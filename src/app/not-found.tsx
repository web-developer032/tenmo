import { Compass, Home, LayoutDashboard, LogIn, MessageSquareWarning } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BackButton } from '@/components/common/back-button';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Global 404 — picked up by Next App Router for unmatched routes and any
 * `notFound()` call deeper in the tree (so it doubles as the empty-state
 * for "this org/property/ticket doesn't exist or you can't see it").
 *
 * Tailors CTAs by auth state:
 *   - Signed in  → "Go to dashboard" hits `/dispatch`, the smart router
 *     that lands the user on the right workspace (landlord/tenant/admin).
 *   - Signed out → "Sign in" + "Back to home".
 *
 * Sticking with a Server Component so we don't ship the auth check to the
 * browser; the BackButton is a small island for the history-aware "go
 * back" CTA.
 */
export default async function NotFound() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-7 w-7" aria-hidden />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            We can&apos;t find that page
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            The link may be broken, or the page may have moved. If a workspace, property or ticket
            should exist here, you might not have access to it from this account.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {isSignedIn ? (
            <Button asChild>
              <Link href="/dispatch" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Go to dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </Button>
            </>
          )}
          <BackButton />
        </div>

        <div className="border-t pt-6">
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Spotted a broken link? Mention the URL in your next reply to support.
          </p>
        </div>
      </div>
    </main>
  );
}
