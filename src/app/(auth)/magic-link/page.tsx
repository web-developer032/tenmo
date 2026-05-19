import Link from 'next/link';
import { MagicLinkForm } from '@/features/auth/components/magic-link-form';

export default function MagicLinkPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-ink">
          Sign in by email
        </h1>
        <p className="text-[13px] text-ink-light">
          We&apos;ll email you a one-time link — no password to remember.
        </p>
      </div>
      <MagicLinkForm />
      <p className="text-center text-[12.5px] text-ink-light">
        Prefer a password?{' '}
        <Link
          href="/login"
          className="font-semibold text-forest-600 underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
