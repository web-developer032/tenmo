import 'server-only';
import { AstEnvelope } from '@/core/schemas/ast';
import { createAstSubmission } from '@/lib/docuseal/client';
import { AppError, DbError, ErrorCode } from '@/lib/errors';
import { type HandlerContext, requireUser } from '@/lib/handler';
import { signUrlFor } from './webhook-mapping';

/**
 * Landlord starts an AST signing run for a tenancy.
 *
 * Side effects:
 *   1. Create a DocuSeal submission (template + values + landlord +
 *      tenant submitters). DocuSeal emails both parties their sign
 *      links automatically.
 *   2. Insert an `ast_envelopes` row with `status='sent'` and the
 *      DocuSeal IDs + sign URLs for instant in-app signing.
 *
 * The partial unique index on `(tenancy_id) where status in
 * ('sent','opened')` is the idempotency guard — a second send with
 * an open envelope already in flight returns 409 (caller can
 * cancel-then-resend if they really want).
 *
 * AST e-sign is intentionally NOT tier-gated — every tenancy
 * legally needs an AST regardless of plan.
 */
export async function startAstEnvelope(
  ctx: HandlerContext,
  tenancyId: string,
): Promise<AstEnvelope> {
  const user = requireUser(ctx);

  const { data: tenancy, error: tenErr } = await ctx.supabase
    .from('tenancies')
    .select(
      `id, org_id, status, tenant_user_id, invite_email,
       rent_pence, rent_frequency, rent_due_day, deposit_pence,
       start_date, end_date, is_periodic,
       properties:property_id ( name, address ),
       rooms:room_id ( name )`,
    )
    .eq('id', tenancyId)
    .maybeSingle();
  if (tenErr) throw new DbError(tenErr);
  if (!tenancy) throw new AppError(404, ErrorCode.not_found, 'Tenancy not found');

  const tenantEmail = tenancy.invite_email ?? (await emailFor(ctx, tenancy.tenant_user_id));
  if (!tenantEmail) {
    throw new AppError(
      422,
      ErrorCode.business_rule_violation,
      'Tenancy has no tenant email — invite the tenant before sending the AST.',
    );
  }

  const landlord = await profileFor(ctx, user.id);
  if (!landlord?.email) {
    throw new AppError(500, ErrorCode.internal_error, 'Could not resolve landlord profile email');
  }

  const property = pickFirst<{ name: string; address: string | null }>(tenancy.properties);
  const room = pickFirst<{ name: string }>(tenancy.rooms);

  const submission = await createAstSubmission({
    submitters: [
      { role: 'landlord', email: landlord.email, name: landlord.name ?? null },
      { role: 'tenant', email: tenantEmail, name: null },
    ],
    values: {
      property_name: property?.name ?? '',
      property_address: property?.address ?? '',
      room_name: room?.name ?? '',
      rent_pence: tenancy.rent_pence,
      rent_frequency: tenancy.rent_frequency,
      rent_due_day: tenancy.rent_due_day,
      deposit_pence: tenancy.deposit_pence,
      start_date: tenancy.start_date,
      end_date: tenancy.end_date ?? '',
      is_periodic: tenancy.is_periodic ? 'true' : 'false',
    },
    metadata: {
      tenancy_id: tenancyId,
      org_id: tenancy.org_id,
    },
  });

  const submissionId = String(submission.id);
  const landlordSignUrl = signUrlFor(submission, 'landlord');
  const tenantSignUrl = signUrlFor(submission, 'tenant');

  const insert = {
    org_id: tenancy.org_id,
    tenancy_id: tenancyId,
    status: 'sent' as const,
    docuseal_submission_id: submissionId,
    docuseal_template_id: submission.template_id ? String(submission.template_id) : null,
    landlord_sign_url: landlordSignUrl,
    tenant_sign_url: tenantSignUrl,
    created_by: user.id,
  };

  const { data: row, error: insErr } = await ctx.supabase
    .from('ast_envelopes')
    .insert(insert)
    .select('*')
    .single();
  if (insErr || !row) {
    if (insErr?.code === '23505') {
      throw new AppError(
        409,
        ErrorCode.conflict,
        'An AST is already in flight for this tenancy. Cancel it before sending a new one.',
      );
    }
    throw new DbError(insErr ?? 'no row returned');
  }

  // Best-effort: move the tenancy from `awaiting_signature` if it's
  // still showing as draft. We don't fail the action if the update
  // doesn't move anything — the envelope is the source of truth.
  if (tenancy.status === 'draft' || tenancy.status === 'pending_invite') {
    await ctx.supabase
      .from('tenancies')
      .update({ status: 'awaiting_signature' })
      .eq('id', tenancyId)
      .in('status', ['draft', 'pending_invite']);
  }

  return AstEnvelope.parse(row);
}

async function profileFor(
  ctx: HandlerContext,
  userId: string,
): Promise<{ email: string | null; name: string | null } | null> {
  const { data, error } = await ctx.supabase
    .from('profiles')
    .select('contact_email, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new DbError(error);
  if (!data) return null;
  return { email: data.contact_email ?? null, name: (data.full_name as string | null) ?? null };
}

async function emailFor(ctx: HandlerContext, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const profile = await profileFor(ctx, userId);
  return profile?.email ?? null;
}

function pickFirst<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
}
