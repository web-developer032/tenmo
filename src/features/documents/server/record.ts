import 'server-only';
import { Document, type RecordDocumentInput } from '@/core/schemas/document';
import { isAllowedMime } from '@/core/utils/document-rules';
import { BusinessRuleError, DbError } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { notifyDocumentUploaded } from './notify';

/**
 * Persist the documents row after the client has uploaded the bytes.
 *
 * The polymorphic-parent shape is enforced both by the discriminated-union
 * Zod schema (caller side) and the database CHECK constraint (server side).
 * RLS gates whether the caller can actually INSERT into this row.
 *
 * Side effects:
 *  - When the document is a `compliance` cert with category `certificate`,
 *    we also stamp `compliance_items.document_path` so the headline doc
 *    pointer stays in sync. The vault keeps the full history.
 */
export async function recordDocument(
  ctx: HandlerContext,
  input: RecordDocumentInput,
): Promise<Document> {
  const user = requireUser(ctx);

  if (!isAllowedMime(input.mime_type)) {
    throw new BusinessRuleError('Unsupported file type');
  }

  // Resolve the org_id from the parent — RLS will reject the insert if
  // the caller can't access the parent, but we need org_id explicitly to
  // populate the row.
  const orgId = await resolveOrgId(ctx, input);

  const row = {
    org_id: orgId,
    kind: input.parent.kind,
    category: input.category,
    property_id: input.parent.kind === 'property' ? input.parent.property_id : null,
    room_id: input.parent.kind === 'room' ? input.parent.room_id : null,
    tenancy_id: input.parent.kind === 'tenancy' ? input.parent.tenancy_id : null,
    compliance_item_id: input.parent.kind === 'compliance' ? input.parent.compliance_item_id : null,
    storage_path: input.storage_path,
    filename: input.filename,
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    title: input.title ?? null,
    description: input.description ?? null,
    uploaded_by: user.id,
  };

  const { data, error } = await ctx.supabase.from('documents').insert(row).select('*').single();
  if (error) throw new DbError(error);

  // Side effect: keep the headline pointer on compliance_items in sync.
  if (input.parent.kind === 'compliance' && input.category === 'certificate') {
    const { error: updErr } = await ctx.supabase
      .from('compliance_items')
      .update({ document_path: input.storage_path })
      .eq('id', input.parent.compliance_item_id);
    if (updErr) {
      ctx.log.warn(
        { err: updErr, complianceItemId: input.parent.compliance_item_id },
        'failed to stamp compliance_items.document_path (non-fatal)',
      );
    }
  }
  // Side effect: AST docs become the headline AST pointer on the tenancy.
  if (input.parent.kind === 'tenancy' && input.category === 'ast') {
    const { error: updErr } = await ctx.supabase
      .from('tenancies')
      .update({ ast_document_path: input.storage_path })
      .eq('id', input.parent.tenancy_id);
    if (updErr) {
      ctx.log.warn(
        { err: updErr, tenancyId: input.parent.tenancy_id },
        'failed to stamp tenancies.ast_document_path (non-fatal)',
      );
    }
  }

  const doc = Document.parse(data);

  // Fire-and-forget notification fan-out. Never blocks the caller.
  void notifyDocumentUploaded(doc);

  return doc;
}

async function resolveOrgId(ctx: HandlerContext, input: RecordDocumentInput): Promise<string> {
  switch (input.parent.kind) {
    case 'compliance': {
      const { data, error } = await ctx.supabase
        .from('compliance_items')
        .select('org_id')
        .eq('id', input.parent.compliance_item_id)
        .single();
      if (error) throw new DbError(error);
      return data.org_id;
    }
    case 'tenancy': {
      const { data, error } = await ctx.supabase
        .from('tenancies')
        .select('org_id')
        .eq('id', input.parent.tenancy_id)
        .single();
      if (error) throw new DbError(error);
      return data.org_id;
    }
    case 'property': {
      const { data, error } = await ctx.supabase
        .from('properties')
        .select('org_id')
        .eq('id', input.parent.property_id)
        .single();
      if (error) throw new DbError(error);
      return data.org_id;
    }
    case 'room': {
      const { data, error } = await ctx.supabase
        .from('rooms')
        .select('property_id')
        .eq('id', input.parent.room_id)
        .single();
      if (error) throw new DbError(error);
      const { data: p, error: pErr } = await ctx.supabase
        .from('properties')
        .select('org_id')
        .eq('id', data.property_id)
        .single();
      if (pErr) throw new DbError(pErr);
      return p.org_id;
    }
    case 'general': {
      throw new BusinessRuleError('general documents must specify an org_id via the route handler');
    }
  }
}
