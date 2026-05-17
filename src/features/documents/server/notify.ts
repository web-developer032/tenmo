import 'server-only';
import type { NotificationKind } from '@/core/constants/notifications';
import type { Document } from '@/core/schemas/document';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Document-vault notification fan-out.
 *
 * Triggered after a document row has been inserted; sends in-app pings
 * (and emails for critical kinds) to the affected tenants. Failures are
 * logged but never rethrown — a notification glitch must not break the
 * upload flow.
 *
 * Recipients:
 *   - `compliance` cert (category=certificate): all active tenants on
 *     the property/room/tenancy the cert is scoped to.
 *   - `tenancy` doc (category=ast | prescribed_information | inventory):
 *     the tenant on that tenancy.
 *
 * Service-role client is used so we can read across tenancies without
 * the actor's RLS scope (the actor is staff, but we want the *tenants'*
 * user_ids regardless of who's logged in).
 */

const log = () => getLogger().child({ module: 'documents.notify' });

export async function notifyDocumentUploaded(doc: Document): Promise<void> {
  try {
    if (doc.kind === 'compliance' && doc.category === 'certificate') {
      await fanOutComplianceCert(doc);
    } else if (doc.kind === 'tenancy' && isTenantFacingTenancyCategory(doc.category)) {
      await fanOutTenancyDoc(doc);
    }
  } catch (err) {
    log().warn({ err, documentId: doc.id }, 'document notify fan-out failed');
  }
}

function isTenantFacingTenancyCategory(category: string): boolean {
  return category === 'ast' || category === 'prescribed_information' || category === 'inventory';
}

async function fanOutComplianceCert(doc: Document): Promise<void> {
  if (!doc.compliance_item_id) return;
  const sb = createServiceClient();

  const { data: item, error } = await sb
    .from('compliance_items')
    .select('id, type, property_id, room_id, tenancy_id')
    .eq('id', doc.compliance_item_id)
    .maybeSingle();
  if (error || !item) {
    log().warn(
      { err: error, complianceItemId: doc.compliance_item_id },
      'compliance lookup failed',
    );
    return;
  }

  const tenantUserIds = await collectAffectedTenants(sb, {
    propertyId: item.property_id,
    roomId: item.room_id,
    tenancyId: item.tenancy_id,
  });

  for (const userId of tenantUserIds) {
    await publish(userId, 'compliance_doc_uploaded', {
      title: 'New compliance certificate',
      body: `A new ${humaniseComplianceType(item.type)} certificate is now on file.`,
      link_url: `/tenant/compliance`,
      entity_type: 'compliance_item',
      entity_id: item.id,
      meta: { document_id: doc.id, certificate_type: item.type },
    });
  }
}

async function fanOutTenancyDoc(doc: Document): Promise<void> {
  if (!doc.tenancy_id) return;
  const sb = createServiceClient();

  const { data: tenancy, error } = await sb
    .from('tenancies')
    .select('id, tenant_user_id, status')
    .eq('id', doc.tenancy_id)
    .maybeSingle();
  if (error || !tenancy?.tenant_user_id) return;
  if (tenancy.status === 'ended' || tenancy.status === 'cancelled') return;

  const label =
    doc.category === 'ast'
      ? 'tenancy agreement'
      : doc.category === 'prescribed_information'
        ? 'prescribed information'
        : 'inventory';

  await publish(tenancy.tenant_user_id, 'tenancy_doc_uploaded', {
    title: `New ${label} added to your tenancy`,
    body: doc.title ?? doc.filename,
    link_url: `/tenant/tenancy/${tenancy.id}`,
    entity_type: 'tenancy',
    entity_id: tenancy.id,
    meta: { document_id: doc.id, category: doc.category },
  });
}

async function collectAffectedTenants(
  sb: ReturnType<typeof createServiceClient>,
  scope: { propertyId: string | null; roomId: string | null; tenancyId: string | null },
): Promise<string[]> {
  const ids = new Set<string>();
  let q = sb
    .from('tenancies')
    .select('tenant_user_id, status, property_id, room_id, id')
    .not('tenant_user_id', 'is', null)
    .in('status', ['pending_invite', 'awaiting_signature', 'awaiting_deposit', 'active']);
  if (scope.tenancyId) q = q.eq('id', scope.tenancyId);
  else if (scope.roomId) q = q.eq('room_id', scope.roomId);
  else if (scope.propertyId) q = q.eq('property_id', scope.propertyId);
  const { data, error } = await q;
  if (error) {
    log().warn({ err: error, scope }, 'tenant fan-out lookup failed');
    return [];
  }
  for (const row of data ?? []) {
    if (row.tenant_user_id) ids.add(row.tenant_user_id);
  }
  return [...ids];
}

async function publish(
  userId: string,
  kind: NotificationKind,
  args: {
    title: string;
    body?: string;
    link_url?: string;
    entity_type?: string;
    entity_id?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await publishNotification({ user_id: userId, kind, ...args });
}

function humaniseComplianceType(type: string): string {
  return type.replace(/_/g, ' ');
}
