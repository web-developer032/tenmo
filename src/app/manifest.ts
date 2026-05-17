import type { MetadataRoute } from 'next';

/**
 * Web App Manifest. Served from `/manifest.webmanifest` thanks to
 * Next's file-based metadata convention.
 *
 * Keep the icons in sync with `app/icon.tsx` + `app/apple-icon.tsx`
 * — they're rendered programmatically (SVG → PNG by Next at
 * build time) so we don't ship binary blobs in the repo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tenantly — UK HMO management',
    short_name: 'Tenantly',
    description:
      "Tenantly is the UK HMO management platform built for the Renters' Rights Bill. Free for tenants, forever.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1115',
    theme_color: '#0f1115',
    lang: 'en-GB',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
