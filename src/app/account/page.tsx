import { ArrowRight, Bell, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileForm } from '@/features/account/components/profile-form';
import { loadCurrentProfile } from '@/features/account/loaders';

export const dynamic = 'force-dynamic';

/**
 * `/account` — the user's editable profile.
 *
 * One profiles row backs every persona (landlord, tenant, admin), so this
 * page is the single edit surface for personal info regardless of which
 * workspace you've come from. Notification preferences and password
 * changes live in their own dedicated pages, linked at the bottom.
 */
export default async function AccountPage() {
  const profile = await loadCurrentProfile();
  if (!profile) redirect('/login?redirect=/account');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your account</h1>
        <p className="text-sm text-muted-foreground">
          Personal details Tenantly uses on invoices, notices and tenant communications. Changes
          apply across every workspace you belong to.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            Profile
          </CardTitle>
          <CardDescription>
            We never sell or share this. See our privacy notice for the full breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initial={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-muted-foreground" />
            More settings
          </CardTitle>
          <CardDescription>
            Choose how Tenantly reaches you and tailor the workspace to your preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href="/account/settings" className="flex items-center gap-2">
              All settings <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/account/settings/notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notification preferences
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
