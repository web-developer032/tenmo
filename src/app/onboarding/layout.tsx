import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/onboarding');

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-6">{children}</div>
    </div>
  );
}
