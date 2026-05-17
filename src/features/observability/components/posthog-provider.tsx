'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { publicEnv } from '@/lib/env.public';

/**
 * Initialises PostHog **once** on the client and wires
 * App Router pageview tracking.
 *
 * - Skips entirely when `NEXT_PUBLIC_POSTHOG_KEY` is unset (so
 *   local devs aren't forced to provide a key).
 * - Uses the EU host by default (matches our hosting region).
 * - Disables session recording — we'll opt-in selectively per
 *   page once we have a clear use case (and a privacy-policy
 *   update covering it).
 *
 * Mounted once from `app/providers.tsx`.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = publicEnv.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (posthog.__loaded) return;

    posthog.init(key, {
      api_host: publicEnv.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // we fire it manually below to use the App Router URL
      capture_pageleave: true,
      autocapture: true,
      disable_session_recording: true,
    });
  }, []);

  const enabled = !!publicEnv.NEXT_PUBLIC_POSTHOG_KEY;
  if (!enabled) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <PostHogPageViews />
      {children}
    </PHProvider>
  );
}

/**
 * App Router page-view emitter. The vanilla PostHog SDK relies
 * on `popstate`/load events that don't fire across Next's
 * client-side navigations, so we listen to pathname/search
 * changes ourselves.
 */
function PostHogPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (typeof window === 'undefined') return;
    if (!posthog.__loaded) return;
    const search = searchParams?.toString();
    const url = `${pathname}${search ? `?${search}` : ''}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
