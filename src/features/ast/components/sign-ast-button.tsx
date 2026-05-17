'use client';

import { FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Tenant-side "Sign now" button. Opens the DocuSeal-hosted sign URL
 * in a new tab so the tenant can come back to the dashboard once
 * they're done. The webhook will reconcile state in the background.
 */
export function SignAstButton({
  signUrl,
  variant = 'default',
  size = 'default',
  className,
}: {
  signUrl: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={signUrl} target="_blank" rel="noopener noreferrer">
        <FileSignature className="mr-2 h-4 w-4" />
        Sign now
      </a>
    </Button>
  );
}
