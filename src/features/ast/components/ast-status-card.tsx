import { CheckCircle2, FileSignature, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AST_STATUS_DESCRIPTION } from '@/core/constants/ast';
import type { AstEnvelope } from '@/core/schemas/ast';
import { isEnvelopeOpen, needsAstSent } from '@/core/utils/ast-rules';
import { AstStatusBadge } from './ast-status-badge';
import { CancelAstButton } from './cancel-ast-button';
import { SendAstButton } from './send-ast-button';
import { SignAstButton } from './sign-ast-button';

/**
 * Shared AST status card. Renders different actions based on the
 * caller's `viewer` role and the envelope's state.
 *
 * - `viewer='landlord'` shows the Send / Cancel CTAs.
 * - `viewer='tenant'`   shows the Sign-now CTA when the envelope is
 *                       still open and a sign URL exists.
 *
 * Server component; the parent passes the loaded envelope row.
 */
export function AstStatusCard({
  tenancyId,
  envelope,
  viewer,
}: {
  tenancyId: string;
  envelope: AstEnvelope | null;
  viewer: 'landlord' | 'tenant';
}) {
  if (needsAstSent(envelope)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" />
            Tenancy agreement
            {envelope ? <AstStatusBadge status={envelope.status} /> : null}
          </CardTitle>
          <CardDescription>
            {viewer === 'landlord'
              ? 'Send the AST so both parties can e-sign before the tenancy goes active.'
              : 'Your landlord has not sent the tenancy agreement yet.'}
          </CardDescription>
        </CardHeader>
        {viewer === 'landlord' ? (
          <CardContent>
            <SendAstButton tenancyId={tenancyId} />
          </CardContent>
        ) : null}
      </Card>
    );
  }

  // We have an envelope. Branch on its status.
  if (envelope?.status === 'completed') {
    return (
      <Card className="border-forest-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" />
            Tenancy agreement signed
            <AstStatusBadge status={envelope.status} />
          </CardTitle>
          <CardDescription>{AST_STATUS_DESCRIPTION[envelope.status]}</CardDescription>
        </CardHeader>
        {envelope.document_path ? (
          <CardContent>
            <a
              href={envelope.document_path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Download signed agreement
            </a>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  if (envelope && (envelope.status === 'declined' || envelope.status === 'expired')) {
    return (
      <Card className="border-amber/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Tenancy agreement
            <AstStatusBadge status={envelope.status} />
          </CardTitle>
          <CardDescription>
            {AST_STATUS_DESCRIPTION[envelope.status]}
            {envelope.decline_reason ? ` — "${envelope.decline_reason}"` : null}
          </CardDescription>
        </CardHeader>
        {viewer === 'landlord' ? (
          <CardContent>
            <SendAstButton tenancyId={tenancyId} label="Re-send AST" />
          </CardContent>
        ) : null}
      </Card>
    );
  }

  // Open (sent / opened).
  if (!envelope) return null;
  const tenantSignUrl = envelope.tenant_sign_url;
  const landlordSignUrl = envelope.landlord_sign_url;
  const showSignButton =
    isEnvelopeOpen(envelope) &&
    ((viewer === 'tenant' && tenantSignUrl) || (viewer === 'landlord' && landlordSignUrl));
  const url = viewer === 'tenant' ? tenantSignUrl : landlordSignUrl;

  return (
    <Card className="border-amber/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4" />
          Tenancy agreement
          <AstStatusBadge status={envelope.status} />
        </CardTitle>
        <CardDescription>{AST_STATUS_DESCRIPTION[envelope.status]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {showSignButton && url ? <SignAstButton signUrl={url} /> : null}
        {viewer === 'landlord' ? <CancelAstButton envelopeId={envelope.id} /> : null}
      </CardContent>
    </Card>
  );
}
