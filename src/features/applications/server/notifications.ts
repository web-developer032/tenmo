import 'server-only';
import { publishNotification } from '@/features/notifications/server';
import { sendEmail } from '@/lib/email';
import { publicEnv } from '@/lib/env.public';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Notifications for the listings + applications loop.
 *
 * Fire-and-forget: failures are logged but never thrown. The application row
 * is the source of truth — re-trying a notification is cheap, blocking the
 * apply / accept / reject flow on Resend would be expensive.
 *
 * Uses the service client because applicants typically can't see
 * `org_memberships`, and landlords typically can't see `auth.users` for the
 * applicant — so neither side has the RLS reach to gather their own
 * recipient list.
 */

const log = () => getLogger().child({ module: 'applications.notifications' });

interface ApplicationContext {
  applicationId: string;
  roomId: string;
  applicantUserId: string;
  applicantEmail: string | null;
  applicantName: string | null;
  roomName: string;
  propertyName: string;
  propertyCity: string | null;
  orgId: string;
  orgSlug: string;
  orgName: string;
  /** Landlord-role recipients for the org — both user_id and email. */
  landlordRecipients: Array<{ user_id: string; email: string | null; name: string | null }>;
  appUrl: string;
}

async function gatherContext(applicationId: string): Promise<ApplicationContext | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('room_applications')
    .select(
      `id, room_id, applicant_user_id,
       rooms:room_id ( id, name, org_id, property_id,
         properties:property_id ( name, address ),
         orgs:org_id ( id, name, slug )
       )`,
    )
    .eq('id', applicationId)
    .maybeSingle();
  if (error) {
    log().error({ err: error, applicationId }, 'load application failed');
    return null;
  }
  if (!data) return null;

  type PropertyEmbed = { name: string; address: { city?: string | null } | null };
  type OrgEmbed = { id: string; name: string; slug: string };
  type RoomShape = {
    id: string;
    name: string;
    org_id: string;
    property_id: string;
    properties: PropertyEmbed | PropertyEmbed[] | null;
    orgs: OrgEmbed | OrgEmbed[] | null;
  };
  const room = data.rooms as unknown as RoomShape | RoomShape[] | null;
  const roomRow = Array.isArray(room) ? room[0] : room;
  if (!roomRow) return null;
  const property = Array.isArray(roomRow.properties) ? roomRow.properties[0] : roomRow.properties;
  const org = Array.isArray(roomRow.orgs) ? roomRow.orgs[0] : roomRow.orgs;

  const { data: applicantProfile } = await sb
    .from('profiles')
    .select('full_name, contact_email')
    .eq('id', data.applicant_user_id)
    .maybeSingle();

  const { data: applicantUser } = await sb.auth.admin.getUserById(data.applicant_user_id);
  const applicantEmail = applicantProfile?.contact_email ?? applicantUser?.user?.email ?? null;

  const { data: landlordRows } = await sb
    .from('org_memberships')
    .select('user_id, profiles:user_id ( full_name, contact_email )')
    .eq('org_id', roomRow.org_id)
    .in('role', ['owner', 'agent'])
    .is('revoked_at', null);

  type ProfileEmbed = { full_name: string | null; contact_email: string | null };
  type LandlordRow = {
    user_id: string;
    profiles: ProfileEmbed | ProfileEmbed[] | null;
  };

  const landlordRecipients = await Promise.all(
    ((landlordRows ?? []) as unknown as LandlordRow[]).map(async (m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      let email = profile?.contact_email ?? null;
      if (!email) {
        const { data: u } = await sb.auth.admin.getUserById(m.user_id);
        email = u?.user?.email ?? null;
      }
      return {
        user_id: m.user_id,
        email,
        name: profile?.full_name ?? null,
      };
    }),
  );

  return {
    applicationId: data.id,
    roomId: roomRow.id,
    applicantUserId: data.applicant_user_id,
    applicantEmail,
    applicantName: applicantProfile?.full_name ?? null,
    roomName: roomRow.name,
    propertyName: property?.name ?? 'a property',
    propertyCity: property?.address?.city ?? null,
    orgId: roomRow.org_id,
    orgSlug: org?.slug ?? roomRow.org_id,
    orgName: org?.name ?? 'A landlord',
    landlordRecipients,
    appUrl: publicEnv.NEXT_PUBLIC_SITE_URL ?? 'https://app.tenantly.co.uk',
  };
}

function listingsManagerLink(ctx: ApplicationContext): string {
  return `${ctx.appUrl}/landlord/${ctx.orgSlug}/listings/${ctx.roomId}/applications`;
}

function tenantApplicationsLink(ctx: ApplicationContext): string {
  return `${ctx.appUrl}/tenant/applications`;
}

export async function notifyApplicationReceived(applicationId: string): Promise<void> {
  try {
    const ctx = await gatherContext(applicationId);
    if (!ctx) return;
    const link = listingsManagerLink(ctx);
    const summary = `${ctx.applicantName ?? 'A new applicant'} applied for ${ctx.roomName} at ${ctx.propertyName}.`;

    for (const recipient of ctx.landlordRecipients) {
      await publishNotification({
        user_id: recipient.user_id,
        kind: 'application_received',
        title: 'New room application',
        body: summary,
        link_url: link,
        entity_type: 'room_application',
        entity_id: ctx.applicationId,
      });
      if (recipient.email) {
        await sendEmail({
          to: recipient.email,
          subject: `New application — ${ctx.roomName}, ${ctx.propertyName}`,
          html: `<p>${summary}</p><p><a href="${link}">Review applicants</a></p>`,
          text: `${summary}\n\n${link}`,
          tags: [
            { name: 'kind', value: 'application_received' },
            { name: 'org', value: ctx.orgId },
          ],
        });
      }
    }
  } catch (err) {
    log().warn({ err, applicationId }, 'notifyApplicationReceived failed');
  }
}

export async function notifyApplicationAccepted(applicationId: string): Promise<void> {
  try {
    const ctx = await gatherContext(applicationId);
    if (!ctx) return;
    const link = tenantApplicationsLink(ctx);
    const message = `${ctx.orgName} accepted your application for ${ctx.roomName} at ${ctx.propertyName}. Watch your invite email — you'll be redirected to set up the tenancy.`;

    await publishNotification({
      user_id: ctx.applicantUserId,
      kind: 'application_accepted',
      title: 'Application accepted',
      body: message,
      link_url: link,
      entity_type: 'room_application',
      entity_id: ctx.applicationId,
    });
    if (ctx.applicantEmail) {
      await sendEmail({
        to: ctx.applicantEmail,
        subject: `Your application was accepted — ${ctx.propertyName}`,
        html: `<p>${message}</p><p><a href="${link}">Open your applications</a></p>`,
        text: `${message}\n\n${link}`,
        tags: [{ name: 'kind', value: 'application_accepted' }],
      });
    }
  } catch (err) {
    log().warn({ err, applicationId }, 'notifyApplicationAccepted failed');
  }
}

export async function notifyApplicationRejected(applicationId: string): Promise<void> {
  try {
    const ctx = await gatherContext(applicationId);
    if (!ctx) return;
    const link = `${ctx.appUrl}/listings`;
    const message = `${ctx.orgName} chose another applicant for ${ctx.roomName} at ${ctx.propertyName}. Don't worry — there are plenty of other rooms on Tenantly.`;

    await publishNotification({
      user_id: ctx.applicantUserId,
      kind: 'application_rejected',
      title: 'Application not selected',
      body: message,
      link_url: link,
      entity_type: 'room_application',
      entity_id: ctx.applicationId,
    });
    if (ctx.applicantEmail) {
      await sendEmail({
        to: ctx.applicantEmail,
        subject: `Update on your application — ${ctx.propertyName}`,
        html: `<p>${message}</p><p><a href="${link}">Browse similar rooms</a></p>`,
        text: `${message}\n\n${link}`,
        tags: [{ name: 'kind', value: 'application_rejected' }],
      });
    }
  } catch (err) {
    log().warn({ err, applicationId }, 'notifyApplicationRejected failed');
  }
}

export async function notifyApplicationWithdrawn(applicationId: string): Promise<void> {
  try {
    const ctx = await gatherContext(applicationId);
    if (!ctx) return;
    const link = listingsManagerLink(ctx);
    const summary = `${ctx.applicantName ?? 'An applicant'} withdrew their application for ${ctx.roomName} at ${ctx.propertyName}.`;

    for (const recipient of ctx.landlordRecipients) {
      await publishNotification({
        user_id: recipient.user_id,
        kind: 'application_withdrawn',
        title: 'Application withdrawn',
        body: summary,
        link_url: link,
        entity_type: 'room_application',
        entity_id: ctx.applicationId,
      });
    }
  } catch (err) {
    log().warn({ err, applicationId }, 'notifyApplicationWithdrawn failed');
  }
}
