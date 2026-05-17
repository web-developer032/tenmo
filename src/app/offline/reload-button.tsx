'use client';

import { Button } from '@/components/ui/button';

/**
 * Hard-reload trigger for the offline shell. We deliberately
 * avoid `next/link` here — App Router navigation goes through
 * the RSC fetcher which would fail again offline. A full
 * `window.location` assignment lets the browser retry the
 * network from scratch.
 */
export function ReloadButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }}
    >
      Reload
    </Button>
  );
}
