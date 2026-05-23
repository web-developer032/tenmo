import { z } from 'zod';
import {
  Address,
  optionalContactEmail,
  optionalContactPhone,
  slug as slugSchema,
} from '@/core/schemas/common';
import { slugify } from '@/core/utils/slug';
import { BusinessRuleError, ConflictError, DbError } from '@/lib/errors';
import { handler } from '@/lib/handler';

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  business_address: Address.optional(),
  contact_email: optionalContactEmail,
  contact_phone: optionalContactPhone,
});

export const POST = handler(
  async ({ req, supabase, user, log }) => {
    if (!user) throw new BusinessRuleError('Sign in required');

    const json = await req.json().catch(() => ({}));
    const input = Body.parse(json);

    const baseSlug = input.slug ?? slugify(input.name);
    const finalSlug = await ensureUniqueSlug(supabase, baseSlug);

    const { data: org, error: orgErr } = await supabase
      .from('orgs')
      .insert({
        name: input.name,
        slug: finalSlug,
        business_address: input.business_address ?? null,
        contact_email: input.contact_email || null,
        contact_phone: input.contact_phone || null,
        created_by: user.id,
      })
      .select('id, slug')
      .single();

    if (orgErr || !org) {
      log.error({ err: orgErr }, 'failed to create org');
      if (orgErr?.code === '23505') {
        throw new ConflictError(undefined, 'Slug already taken');
      }
      throw new DbError(orgErr ?? 'no row returned');
    }

    // Owner `org_memberships` row is created by the `on_org_created`
    // AFTER INSERT trigger (`handle_new_org`). Doing it again here would
    // race the trigger and trip `org_memberships_unique_active`.

    return Response.json({ data: org }, { status: 201 });
  },
  { requireAuth: true },
);

async function ensureUniqueSlug(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  base: string,
): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.from('orgs').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}
