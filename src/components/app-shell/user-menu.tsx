'use client';

import { LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName ?? email} /> : null}
            <AvatarFallback>{initials || 'U'}</AvatarFallback>
          </Avatar>
        </Button>
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
