import 'server-only';
import { Application, type ApplicationAcceptInput } from '@/core/schemas/application';
import { Tenancy } from '@/core/schemas/tenancy';
import { buildInviteUrl } from '@/features/tenancies/invite-url';
import { renderTenancyInviteEmail, sendEmail } from '@/lib/email';
import { AppError, BusinessRuleError, DbError, ErrorCode, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyApplicationAccepted } from './notifications';

/**
 * Landlord-side accept transaction.
 *
 * Calls the `public.accept_room_application` SECURITY DEFINER RPC so the
 * "create tenancy + flip application + close listing" trio is atomic. The
 * sibling auto-reject trigger fires on the application status update inside
 * the RPC, so all losing applicants are rejected with `decline_reason =
 * 'room_filled'` in the same Postgres transaction.
 *
 * After commit:
 *  - Send the tenancy-invite email to the applicant (so they get the same
 *    landing page experience as a directly-invited tenant).
 *  - Publish the `application_accepted` notification (in-app + email).
 *  - Sibling-reject notifications are best-effort and fired by a follow-up
 *    job (handled by the caller's UI showing a toast).
 */
export interface AcceptApplicationResult {
  application: Application;
  tenancy: ReturnType<typeof Tenancy.parse>;
  inviteUrl: string;
  emailSent: boolean;
}

export async function acceptApplication(
  ctx: HandlerContext,
  applicationId: string,
  input: ApplicationAcceptInput,
): Promise<AcceptApplicationResult> {
  requireUser(ctx);

  if (input.deposit_pence < 0 || input.rent_pence < 0) {
    throw new BusinessRuleError('Rent and deposit must be non-negative');
  }

  const { data: rpcRow, error: rpcErr } = await ctx.supabase
    .rpc('accept_room_application', {
      p_application_id: applicationId,
      p_start_date: input.start_date,
      p_rent_pence: input.rent_pence,
      p_rent_frequency: input.rent_frequency,
      p_rent_due_day: input.rent_due_day,
      p_deposit_pence: input.deposit_pence,
      p_deposit_scheme: input.deposit_scheme ?? null,
      p_is_periodic: input.is_periodic,
      p_end_date: input.end_date ?? null,
      p_notes: input.notes ?? null,
    })
    .single();

  if (rpcErr) {
    if (rpcErr.code === '42501') {
      throw new AppError(403, ErrorCode.forbidden, 'You cannot accept applications for this room');
    }
    if (rpcErr.code === '23514') {
      throw new BusinessRuleError(rpcErr.message);
    }
    if (rpcErr.code === 'P0002') {
      throw new NotFoundError(rpcErr.message);
    }
    throw new DbError(rpcErr);
  }
  if (!rpcRow) throw new DbError('accept_room_application returned no row');

  type AcceptRow = { application_id: string; tenancy_id: string };
  const { application_id, tenancy_id } = rpcRow as AcceptRow;

  // Re-load both rows now that they've been mutated transactionally so the
  // caller gets the canonical wire shape (with timestamps, the auto-stamped
  // invite_token, etc.).
  const [{ data: appRow, error: appErr }, { data: tenancyRow, error: tenErr }] = await Promise.all([
    ctx.supabase.from('room_applications').select('*').eq('id', application_id).single(),
    ctx.supabase
      .from('tenancies')
      .select('*, properties:property_id(name, address), rooms:room_id(name), orgs:org_id(name)')
      .eq('id', tenancy_id)
      .single(),
  ]);
  if (appErr) throw new DbError(appErr);
  if (tenErr) throw new DbError(tenErr);

  const application = Application.parse(appRow);
  const tenancy = Tenancy.parse(tenancyRow);

  // Send the tenancy-invite email reusing the existing template so the
  // applicant lands on the same `/invite/[token]` page they would for a
  // direct landlord invite.
  type TenancyEmbed = typeof tenancyRow & {
    invite_token: string;
    properties: { name: string; address: { city?: string } } | null;
    rooms: { name: string } | null;
    orgs: { name: string } | null;
  };
  const enriched = tenancyRow as TenancyEmbed;
  const inviteUrl = buildInviteUrl(enriched.invite_token);
  let emailSent = false;
  if (tenancy.invite_email) {
    const rendered = renderTenancyInviteEmail({
      inviteUrl,
      recipientEmail: tenancy.invite_email,
      landlordOrgName: enriched.orgs?.name ?? 'Your landlord',
      propertyName: enriched.properties?.name ?? 'a property',
      propertyCity: enriched.properties?.address?.city ?? null,
      roomName: enriched.rooms?.name ?? null,
      rentPence: tenancy.rent_pence,
      rentFrequency: tenancy.rent_frequency,
      startDate: tenancy.start_date,
      // The Tenancy zod schema doesn't carry invite_expires_at — we re-pull
      // it from the wire row before discarding. Falling back to null is
      // safe: the email template treats null as "no expiry copy".
      expiresAt: (tenancyRow as { invite_expires_at?: string | null })?.invite_expires_at ?? null,
    });
    const res = await sendEmail({
      to: tenancy.invite_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'kind', value: 'tenancy_invite' },
        { name: 'origin', value: 'application_accept' },
      ],
    });
    emailSent = res.ok;
    if (!res.ok) {
      ctx.log.warn({ err: res.error, applicationId }, 'invite email send failed (non-fatal)');
    }
  }

  // In-app notification fan-out — non-blocking.
  notifyApplicationAccepted(application_id).catch((err) => {
    ctx.log.warn({ err, applicationId }, 'notifyApplicationAccepted failed');
  });

  return { application, tenancy, inviteUrl, emailSent };
}
