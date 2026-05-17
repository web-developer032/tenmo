import { CloudOff } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { ReloadButton } from './reload-button';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

/**
 * Cached app-shell page served by the service worker when the
 * network is unreachable. Intentionally static — no data
 * fetching, only the reload control is interactive.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CloudOff className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">You're offline</h1>
          <p className="text-muted-foreground text-sm">
            Tenantly needs an internet connection to load fresh data. Check your network and try
            again — your draft work is safe in the meantime.
          </p>
          <ReloadButton />
        </CardContent>
      </Card>
    </main>
  );
}
