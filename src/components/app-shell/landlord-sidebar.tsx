'use client';

import {
  Building2,
  CreditCard,
  DoorOpen,
  Home,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
};

export function LandlordSidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const base = `/landlord/${orgSlug}`;

  const nav: NavItem[] = [
    {
      href: base,
      label: 'Dashboard',
      icon: LayoutDashboard,
      match: (p) => p === base,
    },
    { href: `${base}/properties`, label: 'Properties', icon: Building2 },
    { href: `${base}/listings`, label: 'Listings', icon: DoorOpen },
    { href: `${base}/tenancies`, label: 'Tenancies', icon: Home },
    { href: `${base}/finance`, label: 'Finance', icon: Wallet },
    { href: `${base}/maintenance`, label: 'Maintenance', icon: Wrench },
    { href: `${base}/compliance`, label: 'Compliance', icon: ShieldCheck },
    { href: `${base}/billing`, label: 'Billing', icon: CreditCard },
    { href: `${base}/settings`, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Landlord navigation">
      {nav.map((item) => {
        const isActive = item.match
          ? item.match(pathname)
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
