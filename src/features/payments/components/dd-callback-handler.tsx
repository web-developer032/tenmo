'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { completeMandateApi, PaymentsApiError } from '../api/client';

type Status = 'loading' | 'success' | 'error';

/**
 * Client component that runs on the GoCardless redirect-back URL.
 *
 * The browser arrives at `/tenant/rent/{tenancyId}/dd-callback?
 * redirect_flow_id=...` and we POST that flow id to our `/complete`
 * endpoint, which talks to GC and persists the resulting mandate id.
 *
 * Renders a small status card and links the tenant back to their
 * rent page once we're done.
 */
export function DdCallbackHandler({
  tenancyId,
  redirectFlowId,
}: {
  tenancyId: string;
  redirectFlowId: string | null;
}) {
  const [status, setStatus] = React.useState<Status>('loading');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function complete() {
      if (!redirectFlowId) {
        if (cancelled) return;
        setStatus('error');
        setError('Missing redirect_flow_id — please retry the Direct Debit setup.');
        return;
      }
      try {
        await completeMandateApi({ redirect_flow_id: redirectFlowId });
        if (!cancelled) setStatus('success');
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof PaymentsApiError || err instanceof Error
            ? err.message
            : 'Could not finish Direct Debit setup.';
        setStatus('error');
        setError(message);
      }
    }
    void complete();
    return () => {
      cancelled = true;
    };
  }, [redirectFlowId]);

  if (status === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finishing your Direct Debit
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          One moment — confirming your bank details with GoCardless.
        </CardContent>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card className="border-red-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <XCircle className="h-4 w-4 text-red-500" />
            Couldn&apos;t finish setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline">
            <Link href={`/tenant/rent/${tenancyId}`}>Back to rent</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Direct Debit set up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your bank is processing the new Direct Debit. We&apos;ll let you know once it&apos;s live
          — usually within 2–3 working days.
        </p>
        <Button asChild>
          <Link href={`/tenant/rent/${tenancyId}`}>Back to rent</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
