import Link from 'next/link';
import { SignupForm } from '@/features/auth/components/signup-form';

export default function SignupPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-sans text-[22px] font-extrabold tracking-tight text-ink">
          Create your account
        </h1>
        <p className="text-[13px] text-ink-light">
          Free for tenants, forever. Landlords get a 14-day Pro trial — no card needed.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-[12.5px] text-ink-light">
        Already a member?{' '}
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
