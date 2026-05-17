'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginInput, MagicLinkInput, SignupInput } from './schemas';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(input: unknown, redirectTo = '/dispatch'): Promise<ActionResult> {
  const parsed = LoginInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function signupAction(input: unknown): Promise<ActionResult> {
  const parsed = SignupInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const headerList = await headers();
  const origin =
    headerList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: parsed.data.full_name,
        marketing_opt_in: parsed.data.marketing_opt_in,
      },
    },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function magicLinkAction(input: unknown): Promise<ActionResult> {
  const parsed = MagicLinkInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const headerList = await headers();
  const origin =
    headerList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
