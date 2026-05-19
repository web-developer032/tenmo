'use client';

import { Building2, Check, ChevronsUpDown, Home, Plus, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RoleAvailability } from './types';
import { useActiveContext } from './use-active-context';

/**
 * GitHub-style context switcher in the app header.
 *
 * Shows the user's current "scope" (a landlord org, the tenant view, or the admin
 * console) and lets them switch with one click. The list is built from
 * relationships (org memberships, tenancies, admin) — there's no `role` column on
 * users.
 */
export function RoleSwitcher({ availability }: { availability: RoleAvailability }) {
  const router = useRouter();
  const ctx = useActiveContext(availability.orgs);

  const label = React.useMemo(() => {
    if (!ctx) return 'Choose workspace';
    if (ctx.kind === 'landlord') {
      const org = availability.orgs.find((o) => o.slug === ctx.orgSlug);
      return org?.name ?? ctx.orgSlug;
    }
    if (ctx.kind === 'tenant') return 'Tenant';
    return 'Admin';
  }, [ctx, availability.orgs]);

  const Icon = !ctx
    ? ChevronsUpDown
    : ctx.kind === 'landlord'
      ? Building2
      : ctx.kind === 'tenant'
        ? Home
        : Shield;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="hidden gap-1.5 rounded-pill px-3 md:inline-flex"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate text-[12px]">{label}</span>
          <ChevronsUpDown className="h-3 w-3 text-forest-600/70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {availability.orgs.length > 0 ? (
          <>
            <DropdownMenuLabel>Landlord workspaces</DropdownMenuLabel>
            {availability.orgs.map((org) => {
              const isActive = ctx?.kind === 'landlord' && ctx.orgSlug === org.slug;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={() => router.push(`/landlord/${org.slug}`)}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[180px] truncate">{org.name}</span>
                  </span>
                  {isActive ? <Check className="h-4 w-4 text-primary" /> : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        ) : null}

        {availability.hasTenancies ? (
          <DropdownMenuItem
            onSelect={() => router.push('/tenant')}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              Tenant
            </span>
            {ctx?.kind === 'tenant' ? <Check className="h-4 w-4 text-primary" /> : null}
          </DropdownMenuItem>
        ) : null}

        {availability.isAdmin ? (
          <DropdownMenuItem
            onSelect={() => router.push('/admin')}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Admin
            </span>
            {ctx?.kind === 'admin' ? <Check className="h-4 w-4 text-primary" /> : null}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding/create-org" className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            New landlord workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
