import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dispatch';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=Missing+code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const dest = new URL('/login', request.url);
    dest.searchParams.set('error', error.message);
    return NextResponse.redirect(dest);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
