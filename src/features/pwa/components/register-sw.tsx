'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker once the page is hydrated.
 *
 * Skipped in dev so HMR isn't fighting a cached shell, and
 * skipped on browsers that don't expose `serviceWorker`. Updates
 * are picked up automatically thanks to the `Cache-Control:
 * max-age=0, must-revalidate` header on `/sw.js` (set in
 * `next.config.ts`).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Silent — observability already captures registration
        // failures via the Sentry client.
      });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
