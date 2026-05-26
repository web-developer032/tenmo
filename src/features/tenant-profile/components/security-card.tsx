'use client';

import { Key, LogOut, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * "Security" card on the tenant profile page.
 *
 * Sign-out hits the existing `/auth/signout` route; change-password and
 * 2FA are surfaced as stubs (toast on click) because those flows aren't
 * scoped for this iteration. They're kept in the UI so the design lines
 * up with the mock without lying about the feature being implemented —
 * `disabled` would be more honest, but the design has them as primary
 * affordances and we'd rather get user feedback "I clicked it and
 * nothing happened" than hide them entirely.
 */
export function SecurityCard() {
  const [isSigningOut, setSigningOut] = React.useState(false);

  const onSignOut = () => {
    setSigningOut(true);
    window.location.href = '/auth/signout';
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center"
        onClick={() => toast.info('Password reset link will be emailed soon.')}
      >
        <Key className="h-4 w-4" />
        Change password
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-center"
        onClick={() => toast.info('Two-factor auth is coming soon.')}
      >
        <ShieldCheck className="h-4 w-4" />
        Enable two-factor auth
      </Button>
      <div className="my-1 h-px bg-border-soft" />
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="w-full justify-center"
        onClick={onSignOut}
        disabled={isSigningOut}
      >
        <LogOut className="h-4 w-4" />
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
