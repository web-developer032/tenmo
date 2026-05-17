import { ArrowLeft, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/core/utils/money';
import { AstStatusCard } from '@/features/ast/components/ast-status-card';
import { loadActiveEnvelopeForTenancy } from '@/features/ast/loaders';
import { TenancyDocumentsCard } from '@/features/documents/components/tenancy-documents-card';
import { resolveTenancyConversationId } from '@/features/messaging/server';
import { resolveOrgBySlug } from '@/features/orgs/resolve';
import { TenancyActivationChecklist } from '@/features/tenancies/components/activation-checklist';
import { CancelInviteButton } from '@/features/tenancies/components/cancel-invite-button';
import { CopyInviteLinkButton } from '@/features/tenancies/components/copy-invite-link';
import { EndTenancyDialog } from '@/features/tenancies/components/end-tenancy-dialog';
import { buildInviteUrl } from '@/features/tenancies/invite-url';
import { loadTenancy } from '@/features/tenancies/loaders';
import { tenancyStatusDisplay } from '@/features/tenancies/status-display';

type Params = { slug: string; tenancyId: string };

export default async function TenancyDetailPage({ params }: { params: Promise<Params> }) {
  const { slug, tenancyId } = await params;
  const org = await resolveOrgBySlug(slug);
  if (!org) notFound();

  const tenancy = await loadTenancy(tenancyId);
  if (!tenancy || tenancy.org_id !== org.id) notFound();

  const envelope = await loadActiveEnvelopeForTenancy(tenancy.id);

  const status = tenancyStatusDisplay(tenancy.status);
  const conversationId = tenancy.tenant_user_id
    ? await resolveTenancyConversationId(tenancy.id)
    : null;
  const inviteUrl = tenancy.invite_token ? buildInviteUrl(tenancy.invite_token) : null;
  const isPending = tenancy.status === 'pending_invite';
  const isClosable =
    tenancy.status === 'active' ||
    tenancy.status === 'awaiting_signature' ||
    tenancy.status === 'awaiting_deposit';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/landlord/${slug}/tenancies`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to tenancies
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {tenancy.property_name ?? 'Tenancy'}
            {tenancy.room_name ? (
              <span className="text-muted-foreground"> — {tenancy.room_name}</span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tenancy.tenant_email ?? '—'} · started {tenancy.start_date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={status.tone}>{status.label}</Badge>
          {conversationId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/messages/${conversationId}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Message tenant
              </Link>
            </Button>
          ) : null}
          {isPending ? <CancelInviteButton tenancyId={tenancy.id} /> : null}
          {isClosable ? <EndTenancyDialog tenancyId={tenancy.id} /> : null}
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle>Tenancy terms</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href={`/landlord/${slug}/tenancies/${tenancyId}/rent`}>Rent ledger</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <Field label="Rent">
            {formatMoney(tenancy.rent_pence)} {tenancy.rent_frequency === 'weekly' ? '/wk' : '/mo'}
          </Field>
          <Field label="Rent due day">{tenancy.rent_due_day} of the month</Field>
          <Field label="Deposit">{formatMoney(tenancy.deposit_pence)}</Field>
          <Field label="Deposit scheme">{tenancy.deposit_scheme ?? '—'}</Field>
          <Field label="Periodic">{tenancy.is_periodic ? 'Yes' : 'No'}</Field>
          <Field label="End date">{tenancy.end_date ?? '—'}</Field>
        </CardContent>
      </Card>

      {inviteUrl ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Anyone with this link can review the invite. Only{' '}
              <strong>{tenancy.tenant_email}</strong> can accept it.
            </p>
            <Input readOnly value={inviteUrl} className="font-mono text-xs" />
            <div className="flex gap-2">
              <CopyInviteLinkButton url={inviteUrl} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tenancy.status !== 'active' && tenancy.status !== 'ended' ? (
        <TenancyActivationChecklist
          input={{
            tenant_user_id: tenancy.tenant_user_id,
            ast_signed_at: tenancy.ast_signed_at,
            deposit_pence: tenancy.deposit_pence,
            deposit_protected_at: tenancy.deposit_protected_at,
            rtr_current: tenancy.rtr_check_completed_at != null,
            start_date: tenancy.start_date,
          }}
        />
      ) : null}

      <AstStatusCard tenancyId={tenancy.id} envelope={envelope} viewer="landlord" />

      <Card>
        <CardHeader>
          <CardTitle>Compliance milestones</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Field label="Right to Rent">
            {tenancy.rtr_check_completed_at ? '✓ Completed' : 'Pending'}
          </Field>
          <Field label="Deposit protected">
            {tenancy.deposit_protected_at ? '✓ Yes' : 'Not yet'}
          </Field>
          <Field label="Prescribed information">
            {tenancy.prescribed_information_sent_at ? '✓ Sent' : 'Not yet'}
          </Field>
          <Field label="AST signed">{tenancy.ast_signed_at ? '✓ Signed' : 'Not yet'}</Field>
        </CardContent>
      </Card>

      <TenancyDocumentsCard tenancyId={tenancy.id} actorRole="landlord" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}
