import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Log in</CardTitle>
        <CardDescription>Welcome back. Use your email and password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm searchParamsPromise={searchParams} />
        <div className="flex items-center justify-between text-sm">
          <Link
            href="/magic-link"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Email me a link instead
          </Link>
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
