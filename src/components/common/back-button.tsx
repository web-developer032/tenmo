'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * History-aware "go back" navigation primitives.
 *
 * Both `BackButton` and `BackLink` prefer `router.back()` so the user
 * lands on whatever page they actually came from (their landlord
 * workspace, an applications list, the onboarding role-picker, etc.).
 * If there's no prior history entry — direct deep link, fresh tab —
 * they fall back to `fallbackHref` (default `/dispatch`, which routes
 * onboarded users to the right workspace and new users to onboarding).
 *
 * Shared via the `useSmartBack` hook so the two presentations
 * (button vs inline link) can't drift in behaviour.
 *
 * - `BackButton`: full button styling, used on error/empty pages.
 * - `BackLink`:   inline link styling, used inside card headers etc.
 */

function useSmartBack(fallbackHref: string): () => void {
  const router = useRouter();
  return React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);
}

export type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
};

export function BackButton({
  fallbackHref = '/dispatch',
  label = 'Go back',
  variant = 'ghost',
}: BackButtonProps) {
  const goBack = useSmartBack(fallbackHref);
  return (
    <Button type="button" variant={variant} onClick={goBack}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

export type BackLinkProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
};

export function BackLink({
  fallbackHref = '/dispatch',
  label = 'Back',
  className,
}: BackLinkProps) {
  const goBack = useSmartBack(fallbackHref);
  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        'inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="mr-1 h-4 w-4" />
      {label}
    </button>
  );
}
