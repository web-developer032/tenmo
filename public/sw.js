/**
 * Tenantly service worker — minimal MVP slice.
 *
 * Strategy:
 *   - HTML / navigation requests → network-first with a 3 s
 *     timeout, falling back to the cached `/offline` page.
 *   - Static assets (CSS, JS chunks, fonts, images served from
 *     /_next/, /icon, /apple-icon) → stale-while-revalidate.
 *   - API requests → never cached. We don't want stale data on
 *     reconnect, and an offline mutation is a v1.1 problem.
 *
 * Bump CACHE_VERSION whenever we change the strategy. Old caches
 * are cleared during `activate`.
 */

const CACHE_VERSION = 'tenantly-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {
        // The offline page may 404 in dev before it's been compiled
        // — don't trip the install in that case.
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Don't touch cross-origin requests — they're somebody else's
  // problem (Supabase, Stripe, GoCardless, PostHog, Sentry, …).
  if (url.origin !== self.location.origin) return;

  // Never cache API + auth + Sentry tunnel routes.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/monitoring')
  ) {
    return;
  }

  // HTML navigation → network-first, fall back to /offline.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(req));
    return;
  }

  // Static asset → stale-while-revalidate.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/apple-icon') ||
    /\.(?:css|js|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|avif)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirstWithOfflineFallback(request) {
  try {
    const network = await fetchWithTimeout(request, 3000);
    return network;
  } catch (_err) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(OFFLINE_URL);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response('', { status: 504 });
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
