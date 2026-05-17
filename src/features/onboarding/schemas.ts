import { z } from 'zod';
import {
  Address,
  optionalContactEmail,
  optionalContactPhone,
  slug as slugSchema,
} from '@/core/schemas/common';

/**
 * Onboarding inputs — what role(s) the user wants, and an org if landlord.
 * Roles are not stored on the user; they're inferred from memberships and tenancies.
 */
export const OnboardingChoice = z.enum(['landlord', 'tenant', 'both']);
export type OnboardingChoice = z.infer<typeof OnboardingChoice>;

export const CreateOrgInput = z.object({
  name: z.string().trim().min(2, 'Org name is too short').max(120, 'Keep it under 120 characters'),
  slug: slugSchema.optional(),
  business_address: Address.optional(),
  contact_email: optionalContactEmail,
  contact_phone: optionalContactPhone,
});
export type CreateOrgInput = z.infer<typeof CreateOrgInput>;
