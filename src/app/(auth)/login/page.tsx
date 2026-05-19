import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-ink">Log in</h1>
        <p className="text-[13px] text-ink-light">Welcome back. Use your email and password.</p>
      </div>
      <LoginForm searchParamsPromise={searchParams} />
      <div className="flex items-center justify-between text-[12.5px]">
        <Link href="/magic-link" className="text-ink-light hover:text-forest-600 hover:underline">
          Email me a link instead
        </Link>
        <Link
          href="/signup"
          className="font-semibold text-forest-600 underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
