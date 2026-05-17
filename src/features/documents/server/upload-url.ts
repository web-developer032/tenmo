import 'server-only';
import { DOCUMENT_BUCKET, type DocumentKind } from '@/core/constants/documents';
import type { CreateUploadUrlInput, UploadUrlResponse } from '@/core/schemas/document';
import { buildStoragePath, isAllowedMime } from '@/core/utils/document-rules';
import { BusinessRuleError, DbError, ErrorCode, ForbiddenError, NotFoundError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';

/**
 * Mint a signed upload URL for the documents bucket.
 *
 * The flow is the same as Phase F's ticket attachments:
 *   1. Client asks the server for a signed PUT URL.
 *   2. Server resolves the parent (compliance item / tenancy / property /
 *      room) to its `org_id`, asserts the caller has the right role, and
 *      builds a path of the form `{org_id}/{kind}/{parent_id}/{nanoid-name}`.
 *   3. Server mints a 5-minute signed upload URL via the Supabase Storage
 *      SDK and returns it.
 *   4. Client uploads directly to storage (no bytes through our API).
 *   5. Client calls `/api/documents` to record the row, passing the path.
 *
 * Authorisation: only `owner / agent / staff` can mint upload URLs. The
 * underlying storage RLS enforces the same — this check just gives the
 * caller a helpful 403 instead of a confusing 400 from the storage SDK.
 */

const SIGN_UPLOAD_TTL_SECONDS = 60 * 5;

export type UploadParentResolved = {
  org_id: string;
  parent_id: string | null;
};

/**
 * Look up the parent referenced by an upload-url request and return its
 * `org_id` plus a stable parent identifier for the storage path.
 */
async function resolveParent(
  ctx: HandlerContext,
  input: CreateUploadUrlInput,
): Promise<UploadParentResolved> {
  const { parent } = input;
  switch (parent.kind) {
    case 'compliance': {
      const { data, error } = await ctx.supabase
        .from('compliance_items')
        .select('id, org_id')
        .eq('id', parent.compliance_item_id)
        .maybeSingle();
      if (error) throw new DbError(error);
      if (!data) throw new NotFoundError('Compliance item not found');
      return { org_id: data.org_id, parent_id: data.id };
    }
    case 'tenancy': {
      const { data, error } = await ctx.supabase
        .from('tenancies')
        .select('id, org_id')
        .eq('id', parent.tenancy_id)
        .maybeSingle();
      if (error) throw new DbError(error);
      if (!data) throw new NotFoundError('Tenancy not found');
      return { org_id: data.org_id, parent_id: data.id };
    }
    case 'property': {
      const { data, error } = await ctx.supabase
        .from('properties')
        .select('id, org_id')
        .eq('id', parent.property_id)
        .maybeSingle();
      if (error) throw new DbError(error);
      if (!data) throw new NotFoundError('Property not found');
      return { org_id: data.org_id, parent_id: data.id };
    }
    case 'room': {
      const { data, error } = await ctx.supabase
        .from('rooms')
        .select('id, property_id')
        .eq('id', parent.room_id)
        .maybeSingle();
      if (error) throw new DbError(error);
      if (!data) throw new NotFoundError('Room not found');
      // Rooms don't carry org_id directly — derive via property.
      const { data: prop, error: pErr } = await ctx.supabase
        .from('properties')
        .select('org_id')
        .eq('id', data.property_id)
        .maybeSingle();
      if (pErr) throw new DbError(pErr);
      if (!prop) throw new NotFoundError('Room property not found');
      return { org_id: prop.org_id, parent_id: data.id };
    }
    case 'general': {
      // The org for a general document is the caller's currently-active
      // org. We require an explicit `org_id` to be sent via header on the
      // route handler instead of guessing — but if the route doesn't pass
      // one, we throw a clear error.
      throw new BusinessRuleError(
        'general documents require an explicit org_id — pass it in the route handler',
      );
    }
  }
}

export async function createDocumentUploadUrl(
  ctx: HandlerContext,
  input: CreateUploadUrlInput,
  /** Override parent resolution (used by the `general`-kind route which
   * supplies the org_id directly). */
  overrideOrgId?: string,
): Promise<UploadUrlResponse & { org_id: string; kind: DocumentKind }> {
  if (!isAllowedMime(input.mime_type)) {
    throw new BusinessRuleError('Unsupported file type');
  }

  const resolved =
    input.parent.kind === 'general' && overrideOrgId
      ? { org_id: overrideOrgId, parent_id: null }
      : await resolveParent(ctx, input);

  // Defence in depth — the storage RLS will also block this, but we want
  // a clean 403 here so the UI can surface "ask your owner to grant you
  // staff access" rather than a confusing storage error.
  const user = requireUser(ctx);
  const { data: membership, error: mErr } = await ctx.supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', resolved.org_id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .in('role', ['owner', 'agent', 'staff'])
    .maybeSingle();
  if (mErr) throw new DbError(mErr);
  if (!membership)
    throw new ForbiddenError(ErrorCode.not_org_member, 'Only org staff can upload documents');

  const path = buildStoragePath({
    orgId: resolved.org_id,
    kind: input.parent.kind,
    parentId: resolved.parent_id,
    filename: input.filename,
  });

  const { data, error } = await ctx.supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    ctx.log.error({ err: error, path }, 'createSignedUploadUrl failed');
    throw new BusinessRuleError(error?.message ?? 'Could not create upload URL');
  }

  return {
    storage_path: data.path,
    signed_url: data.signedUrl,
    token: data.token,
    expires_in_seconds: SIGN_UPLOAD_TTL_SECONDS,
    org_id: resolved.org_id,
    kind: input.parent.kind,
  };
}
