'use client';

import { LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/features/auth/actions';

export type UserMenuProps = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export function UserMenu({ email, fullName, avatarUrl }: UserMenuProps) {
  const initials = React.useMemo(() => {
    const source = fullName ?? email;
    return source
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [fullName, email]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-offset-background transition-colors hover:ring-2 hover:ring-forest-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600/30"
        >
          <Avatar className="h-9 w-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName ?? email} /> : null}
            <AvatarFallback className="bg-foam font-sans text-[12px] font-bold text-forest-700">
              {initials || 'U'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="space-y-0.5">
            {fullName ? <p className="text-sm font-medium leading-none">{fullName}</p> : null}
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
