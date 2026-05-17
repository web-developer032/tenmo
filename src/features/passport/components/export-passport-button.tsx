'use client';

import { Download, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { generatePassportApi, PassportApiError } from '../api/client';

/**
 * "Export Passport PDF" button. Generates server-side, opens the
 * resulting signed URL in a new tab so the browser handles the
 * download natively.
 */
export function ExportPassportButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handle() {
    setPending(true);
    try {
      const result = await generatePassportApi();
      toast.success('Passport ready — opening download.');
      window.open(result.download_url, '_blank', 'noopener,noreferrer');
      router.refresh();
    } catch (err) {
      const msg = err instanceof PassportApiError ? err.message : 'Could not generate passport.';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button onClick={handle} disabled={pending} className={className}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {pending ? 'Generating…' : 'Export passport PDF'}
    </Button>
  );
}
