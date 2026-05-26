'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Banner, type BannerProps } from '@/components/ds';

/**
 * Client-side wrapper for the design-system Banner that remembers a
 * dismissed state in `localStorage` per storage key. Use for non-
 * critical operational notices (e.g. /admin/billing payment-failure
 * banner) so admins can clear them without losing the underlying
 * data row.
 */
export function DismissableBanner({
  storageKey,
  ...bannerProps
}: BannerProps & { storageKey: string }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(storageKey);
      setDismissed(value === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (dismissed === null || dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      /* ignore quota / privacy errors */
    }
    setDismissed(true);
  };

  return (
    <Banner
      {...bannerProps}
      actions={
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-light transition-colors hover:bg-white hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      }
    />
  );
}
