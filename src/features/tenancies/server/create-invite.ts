import { Tenancy, type TenancyInvite } from '@/core/schemas/tenancy';
import { renderTenancyInviteEmail, sendEmail } from '@/lib/email';
import { BusinessRuleError, ConflictError, DbError } from '@/lib/errors';
import type { HandlerContext } from '@/lib/handler';
import { buildInviteUrl } from '../invite-url';

export type CreateInviteResult = {
  tenancy: ReturnType<typeof Tenancy.parse>;
  inviteUrl: string;
  emailSent: boolean;
};

/**
 * Landlord creates a pending tenancy invite.
 *
 * Side effects:
 *  - Inserts a `tenancies` row with `status = 'pending_invite'`. The DB trigger
 *    `tenancies_fill_invite_defaults` generates the token + expiry.
 *  - Sends the invite email via Resend (or logs to console in dev). Email
 *    failures are non-fatal — the row is the source of truth and the link
 *    can be re-sent or copied from the UI.
 */
export async function createTenancyInvite(
  ctx: HandlerContext,
  orgId: string,
  input: TenancyInvite,
  user: { id: string },
): Promise<CreateInviteResult> {
  if (input.deposit_pence < 0 || input.rent_pence < 0) {
    throw new BusinessRuleError('Rent and deposit must be non-negative');
  }

  const { data: property, error: propErr } = await ctx.supabase
    .from('properties')
    .select('id, org_id, name, address')
    .eq('id', input.property_id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (propErr) throw new DbError(propErr);
  if (!property) {
    throw new BusinessRuleError('Property not found in this organisation');
  }

  if (input.room_id) {
    const { data: room, error: roomErr } = await ctx.supabase
      .from('rooms')
      .select('id, status, org_id, property_id')
      .eq('id', input.room_id)
      .eq('property_id', input.property_id)
      .maybeSingle();
    if (roomErr) throw new DbError(roomErr);
    if (!room) {
      throw new BusinessRuleError('Room not found in the selected property');
    }
    if (room.status === 'archived') {
      throw new BusinessRuleError('Cannot invite a tenant to an archived room');
    }
  }

  const { data, error } = await ctx.supabase
    .from('tenancies')
    .insert({
      org_id: orgId,
      property_id: input.property_id,
      room_id: input.room_id ?? null,
      invite_email: input.invite_email.trim().toLowerCase(),
      status: 'pending_invite',
      start_date: input.start_date,
      rent_pence: input.rent_pence,
      rent_frequency: input.rent_frequency,
      rent_due_day: input.rent_due_day,
      deposit_pence: input.deposit_pence,
      deposit_scheme: input.deposit_scheme,
      created_by: user.id,
    })
    .select('*, properties:property_id(name, address), rooms:room_id(name), orgs:org_id(name)')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ConflictError(undefined, 'A tenancy with that invite token already exists');
    }
    throw new DbError(error);
  }

  const row = data as typeof data & {
    invite_token: string;
    properties: { name: string; address: { city?: string } } | null;
    rooms: { name: string } | null;
    orgs: { name: string } | null;
  };

  const tenancy = Tenancy.parse(row);
  const inviteUrl = buildInviteUrl(row.invite_token);

  const rendered = renderTenancyInviteEmail({
    inviteUrl,
    recipientEmail: input.invite_email,
    landlordOrgName: row.orgs?.name ?? 'Your landlord',
    propertyName: row.properties?.name ?? 'a property',
    propertyCity: row.properties?.address?.city ?? null,
    roomName: row.rooms?.name ?? null,
    rentPence: input.rent_pence,
    rentFrequency: input.rent_frequency,
    startDate: input.start_date,
    expiresAt: tenancy.invite_token ? null : null,
  });

  const emailRes = await sendEmail({
    to: input.invite_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: [
      { name: 'kind', value: 'tenancy_invite' },
      { name: 'org', value: orgId },
    ],
  });

  if (!emailRes.ok) {
    ctx.log.warn({ err: emailRes.error }, 'invite email send failed (non-fatal)');
  }

  return { tenancy, inviteUrl, emailSent: emailRes.ok };
}
