import { AlertCircle, CalendarDays, MapPin, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TenancyInvitePreview } from '@/core/schemas/tenancy';
import { formatMoney } from '@/core/utils/money';
import { AcceptInviteButton } from '@/features/invites/components/accept-invite-button';
import { createClient } from '@/lib/supabase/server';

type Params = { token: string };

export const dynamic = 'force-dynamic';

/**
 * Public invite landing page. Anyone with the token can view the invite
 * details (server-side via SECURITY DEFINER RPC). Only the matching email
 * (after sign-in) can accept.
 */
export default async function InvitePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: previewRow, error } = await supabase
    .rpc('preview_tenancy_invite', { p_token: token })
    .maybeSingle();

  const preview = previewRow ? safeParsePreview(previewRow) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 bg-bg-page px-4 py-10 lg:py-14">
      <header className="space-y-1 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-forest-600">Tenantly</p>
        <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-ink lg:text-[28px]">
          You&apos;ve been invited to a tenancy
        </h1>
        <p className="text-[13px] text-ink-light">
          Tenantly is <strong className="text-ink">free for tenants — forever</strong>. No fees, no
          card.
        </p>
      </header>

      {error || !preview ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>This invite isn&apos;t available</AlertTitle>
          <AlertDescription>
            The link may be expired, already used, or cancelled by the landlord. Ask them to send a
            fresh invite.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <MapPin className="h-4 w-4 text-forest-600" />
                {preview.property_name}
                {preview.room_name ? (
                  <span className="text-ink-light">— {preview.room_name}</span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <Field label="Landlord">{preview.org_name}</Field>
              <Field label="Invitee email">{preview.invite_email}</Field>
              <Field label="Move-in date" icon={<CalendarDays className="h-3.5 w-3.5" />}>
                {preview.start_date}
              </Field>
              <Field label="Rent">
                {formatMoney(preview.rent_pence)}{' '}
                {preview.rent_frequency === 'weekly' ? '/wk' : '/mo'}
              </Field>
              <Field label="Deposit">{formatMoney(preview.deposit_pence)}</Field>
              <Field label="Expires">
                {preview.invite_expires_at
                  ? new Date(preview.invite_expires_at).toLocaleDateString('en-GB')
                  : '—'}
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-forest-600" />
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[13px] text-ink-mid">
              <ol className="list-inside list-decimal space-y-1.5">
                <li>Accept the invite below (or sign up first — it&apos;s free).</li>
                <li>
                  Your landlord prepares a <strong>periodic AST</strong> compliant with the
                  Renters&apos; Rights Bill — Section 21 is abolished.
                </li>
                <li>
                  Sign the agreement and your deposit is protected with a government-backed scheme.
                </li>
                <li>You move in. Pay rent in-app — or any way you like, your choice.</li>
              </ol>
              {!user ? (
                <Alert>
                  <AlertTitle>Sign in to accept</AlertTitle>
                  <AlertDescription>
                    You must be signed in with <strong>{preview.invite_email}</strong> to accept
                    this invite.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          {user ? (
            <AcceptInviteButton token={token} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild size="lg">
                <Link
                  href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(preview.invite_email)}`}
                >
                  Sign in
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link
                  href={`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(preview.invite_email)}`}
                >
                  Create account
                </Link>
              </Button>
            </div>
          )}
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Wasn&apos;t expecting this? You can safely close this page.
      </p>
    </main>
  );
}

function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-light">
        {icon}
        {label}
      </div>
      <div className="font-semibold text-ink">{children}</div>
    </div>
  );
}

function safeParsePreview(row: unknown) {
  const result = TenancyInvitePreview.safeParse(row);
  return result.success ? result.data : null;
}
