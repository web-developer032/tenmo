import { describe, expect, it } from 'vitest';
import { buildInviteUrl } from '@/features/tenancies/invite-url';

describe('buildInviteUrl', () => {
  it('produces an absolute /invite/[token] URL using NEXT_PUBLIC_SITE_URL', () => {
    const url = buildInviteUrl('abc123');
    expect(url).toBe('http://localhost:3000/invite/abc123');
  });

  it('encodes tokens that contain reserved chars', () => {
    const url = buildInviteUrl('with/slash and+plus');
    expect(url).toContain('/invite/');
    expect(url).not.toContain(' ');
    expect(url).toContain('%2F');
  });
});
