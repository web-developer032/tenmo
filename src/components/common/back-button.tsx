'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Client-only "go back" button — used by error pages (404, 5xx) where we
 * can't know what page the user came from on the server. Falls back to
 * `/` when there's no previous entry in the browser history (e.g. the
 * user opened the bad URL in a fresh tab).
 *
 * Kept in `components/common` so any error/empty page can drop it in
 * without re-implementing the history fallback.
 */
export type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
};

export function BackButton({
  fallbackHref = '/',
  label = 'Go back',
  variant = 'ghost',
}: BackButtonProps) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
