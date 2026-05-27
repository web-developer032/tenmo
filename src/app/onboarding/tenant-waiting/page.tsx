import { MailQuestion } from 'lucide-react';
import Link from 'next/link';
import { BackLink } from '@/components/common/back-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TenantWaitingPage() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <BackLink fallbackHref="/dispatch" />
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MailQuestion className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Waiting on your landlord</CardTitle>
        <CardDescription>
          Tenants are added to Tenantly by invitation. Ask your landlord to send you one —
          we&apos;ll email a link as soon as they do.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>
          When you receive an invitation, click the link inside it. You&apos;ll be taken straight to
          your tenant dashboard with rent schedule, deposit info and maintenance tools.
        </p>
        <p>
          Tenantly is{' '}
          <span className="font-semibold text-foreground">free for tenants — forever</span>. We make
          our money from landlords on subscription, never from you.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" asChild>
            <Link href="/dispatch">Refresh status</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/onboarding">Switch to landlord</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
