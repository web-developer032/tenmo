import { z } from 'zod';

export const Email = z.email('Enter a valid email address');
export const Password = z.string().min(8, 'At least 8 characters').max(128);

export const LoginInput = z.object({
  email: Email,
  password: Password,
});
export type LoginInput = z.infer<typeof LoginInput>;

export const SignupInput = z.object({
  email: Email,
  password: Password,
  full_name: z.string().trim().min(2, 'Tell us your name').max(120, 'A bit shorter, please'),
  marketing_opt_in: z.boolean().default(false),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const MagicLinkInput = z.object({
  email: Email,
});
export type MagicLinkInput = z.infer<typeof MagicLinkInput>;
