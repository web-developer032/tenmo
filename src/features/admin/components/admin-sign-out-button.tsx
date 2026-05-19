'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';

export function AdminSignOutButton() {
  const [pending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      try {
        await logoutAction();
        // logoutAction redirects; this toast is a safety net.
        toast.success('Signed out');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not sign out');
      }
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={pending}>
      <LogOut className="mr-1.5 h-3.5 w-3.5" />
      Sign out
    </Button>
  );
}
