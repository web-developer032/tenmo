import { z } from 'zod';
import { Address, slug, uuid } from './common';

/**
 * An organisation is a landlord business. One user may belong to many orgs.
 * Owns properties, holds the subscription, drives RBAC.
 */
export const OrgRole = z.enum(['owner', 'agent', 'staff']);
export type OrgRole = z.infer<typeof OrgRole>;

export const Org = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
  slug,
  business_address: Address.nullable(),
  contact_email: z.string().email().nullable(),
  contact_phone: z.string().nullable(),
  vat_number: z.string().nullable(),
  company_number: z.string().nullable(),
  logo_url: z.string().url().nullable(),
  created_by: uuid,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Org = z.infer<typeof Org>;

export const OrgCreate = Org.pick({ name: true }).extend({
  slug: slug.optional(),
});
export type OrgCreate = z.infer<typeof OrgCreate>;

export const OrgUpdate = Org.pick({
  name: true,
  business_address: true,
  contact_email: true,
  contact_phone: true,
  vat_number: true,
  company_number: true,
  logo_url: true,
}).partial();
export type OrgUpdate = z.infer<typeof OrgUpdate>;

/** Membership — links a user to an org with a role. */
export const OrgMembership = z.object({
  id: uuid,
  org_id: uuid,
  user_id: uuid,
  role: OrgRole,
  invited_by: uuid.nullable(),
  invited_at: z.string().nullable(),
  accepted_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OrgMembership = z.infer<typeof OrgMembership>;
