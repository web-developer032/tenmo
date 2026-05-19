import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dispatch');

  return (
    <div className="grid min-h-dvh place-items-center bg-bg-page px-4 py-12">
      <div className="w-full max-w-[480px]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-forest-600 text-white shadow-(--shadow-card)"
            aria-label="Tenantly home"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <title>Tenantly logo</title>
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </Link>
          <Link href="/" className="font-sans text-[20px] font-extrabold tracking-tight text-ink">
            Tenantly
          </Link>
        </div>
        <div className="rounded-card border border-border-soft bg-white p-6 shadow-(--shadow-card) lg:p-8">
          {children}
        </div>
        <p className="mt-4 text-center text-[11.5px] text-ink-light">
          UK HMO management · Free for tenants, forever
        </p>
      </div>
    </div>
  );
}
