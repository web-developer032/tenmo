import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  /**
   * Packages that must be loaded from `node_modules` at runtime instead
   * of bundled by webpack/Turbopack.
   *
   * - `pdfkit` ships its built-in font metrics (`Helvetica.afm` and
   *   friends) as data files alongside the JS, and reads them at
   *   runtime with `fs.readFileSync` resolved relative to the package's
   *   location on disk. Bundling moves the JS into `.next/server/...`
   *   while leaving the `.afm` files behind, breaking PDF generation
   *   with ENOENT. Marking it external keeps the `require()` resolution
   *   pointed at `node_modules/.../pdfkit/js/data/Helvetica.afm`.
   */
  serverExternalPackages: ['pdfkit'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        // Service worker must be served from the origin root and
        // is not allowed to be cached aggressively — otherwise
        // updates never roll out.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

/**
 * Sentry's webpack plugin needs `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`
 * and `SENTRY_PROJECT` at build-time to upload sourcemaps. When
 * any of those are missing (typical local dev) we skip the wrap
 * and just export the raw Next config — runtime Sentry SDK still
 * works via `instrumentation*.ts`.
 */
const sentryEnabled =
  !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Tunnel through a same-origin route so ad-blockers don't
      // strip our error reports.
      tunnelRoute: '/monitoring',
      // Suppress noisy SDK logs in CI / Vercel build output.
      silent: !process.env.CI,
      // Tree-shake the SDK debug logger from production bundles.
      disableLogger: true,
      widenClientFileUpload: true,
    })
  : nextConfig;
