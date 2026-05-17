import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { RegisterServiceWorker } from '@/features/pwa/components/register-sw';
import { Providers } from './providers';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Tenantly — UK HMO management',
    template: '%s · Tenantly',
  },
  description:
    "Tenantly is the UK HMO management platform built for the Renters' Rights Bill. Free for tenants, forever.",
  applicationName: 'Tenantly',
  authors: [{ name: 'Tenantly' }],
  // Manifest + icons are emitted by file-based metadata routes
  // (app/manifest.ts, app/icon.tsx, app/icon-32.tsx,
  // app/apple-icon.tsx). Next links them automatically.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1115' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster richColors closeButton position="top-right" />
          <RegisterServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
