import { Banknote, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MANDATE_NEEDS_SETUP } from '@/core/constants/payments';
import type { GoCardlessMandate } from '@/core/schemas/payments';
import { CancelDdButton } from './cancel-dd-button';
import { MandateStatusBadge } from './mandate-status-badge';
import { SetupDdButton } from './setup-dd-button';

/**
 * Tenant-facing summary of the Direct Debit mandate for a tenancy.
 *
 * Renders one of three states:
 *   - No mandate / cancelled / failed / expired → "Set up DD" CTA.
 *   - Submitted (awaiting bank) → blue notice + status badge.
 *   - Active → green confirmation + Cancel button.
 *
 * Server component — pulls no data of its own; the parent passes the
 * mandate row (or null). Keeps the page-level loader as the single
 * source of truth for what's loaded.
 */
export function MandateStatusCard({
  tenancyId,
  mandate,
}: {
  tenancyId: string;
  mandate: GoCardlessMandate | null;
}) {
  const needsSetup = !mandate || MANDATE_NEEDS_SETUP[mandate.status];

  if (needsSetup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Pay rent automatically
            {mandate ? <MandateStatusBadge status={mandate.status} /> : null}
          </CardTitle>
          <CardDescription>
            Set up a Direct Debit and your rent will be collected each period — no chasing, no fees
            on top.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupDdButton tenancyId={tenancyId} />
        </CardContent>
      </Card>
    );
  }

  if (mandate.status === 'submitted' || mandate.status === 'pending_submission') {
    return (
      <Card className="border-amber/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Direct Debit
            <MandateStatusBadge status={mandate.status} />
          </CardTitle>
          <CardDescription>
            Your bank is processing the new Direct Debit. This usually takes 2–3 working days.
            We&apos;ll let you know as soon as it&apos;s ready.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-forest-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Direct Debit active
          <MandateStatusBadge status={mandate.status} />
        </CardTitle>
        <CardDescription>
          Your rent will be collected automatically each period. We&apos;ll email you 3 working days
          before each collection. You can cancel any time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CancelDdButton mandateId={mandate.id} />
      </CardContent>
    </Card>
  );
}
