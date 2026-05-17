import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MagicLinkForm } from '@/features/auth/components/magic-link-form';

export default function MagicLinkPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Sign in by email</CardTitle>
        <CardDescription>
          We&apos;ll email you a one-time link — no password to remember.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MagicLinkForm />
        <p className="text-center text-sm text-muted-foreground">
          Prefer a password?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
