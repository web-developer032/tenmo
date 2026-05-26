import 'server-only';
import { cookies } from 'next/headers';
import { IMPERSONATION_TARGET_COOKIE } from './constants';

/**
 * Cheap, read-only impersonation context inspector. Returns the
 * decoded target metadata when an impersonation session is active,
 * or `null` otherwise. The backup cookie holding the admin's original
 * Supabase session is httpOnly + signed, so this helper deliberately
 * only reads the **public** marker cookie (the one with the target's
 * display info).
 */

export type ImpersonationContext = {
  userId: string;
  email: string;
  name: string;
};

export async function readImpersonationContext(): Promise<ImpersonationContext | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_TARGET_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ImpersonationContext>;
    if (!parsed.userId || !parsed.email) return null;
    return {
      userId: parsed.userId,
      email: parsed.email,
      name: parsed.name ?? parsed.email,
    };
  } catch {
    return null;
  }
}
