import { ArrowRight, Bell, UserRound } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadCurrentProfile } from '@/features/account/loaders';

export const dynamic = 'force-dynamic';

/**
 * `/account/settings` — settings index.
 *
 * Lists every settings sub-area as its own card. Currently:
 *   - Notification preferences (`/account/settings/notifications`)
 *   - Profile (`/account` — full edit form for name, contact details,
 *     locale, timezone, theme and marketing opt-in).
 *
 * New settings categories add a card here; the layout is intentionally
 * one-card-per-area so it scales without redesign.
 */

type SettingsLink = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const SETTINGS_LINKS: SettingsLink[] = [
  {
    href: '/account/settings/notifications',
    title: 'Notifications',
    description:
      'Email and in-app channels per category. Critical alerts are always emailed so nothing important slips.',
    icon: <Bell className="h-4 w-4 text-muted-foreground" />,
  },
  {
    href: '/account',
    title: 'Profile',
    description:
      'Your name, contact details, locale, time zone and theme. Used on invoices and tenant comms.',
    icon: <UserRound className="h-4 w-4 text-muted-foreground" />,
  },
];

export default async function AccountSettingsPage() {
  const profile = await loadCurrentProfile();
  if (!profile) redirect('/login?redirect=/account/settings');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Tailor how Tenantly works for you. Changes apply across every workspace you belong to.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4">
        {SETTINGS_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition hover:border-foreground/20 hover:bg-muted/30">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {item.icon}
                      {item.title}
                    </CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </CardHeader>
                <CardContent className="hidden" />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
