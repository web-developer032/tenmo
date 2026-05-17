import { publicEnv } from '@/lib/env.public';

/**
 * Build the public, share-safe URL for a tenancy invite token.
 * Used by both the email template and the landlord UI ("copy invite link").
 */
export function buildInviteUrl(token: string): string {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/invite/${encodeURIComponent(token)}`;
}
