'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/cn';

/*
 * Mobile sidebar drawer.
 *
 * Wraps any `<Sidebar />` component in a left-side slide-out drawer using
 * Radix Dialog. The drawer is only mounted below `lg`; at `lg+` the
 * sidebar renders inline (see AppShell). The drawer auto-closes when the
 * route changes — without this, navigating from inside the drawer leaves
 * it open.
 *
 * Trigger is a hamburger button that lives in the topbar only on mobile.
 * Both pieces are exported separately so AppShell can place them in
 * different spots.
 */

type DrawerContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

export function MobileDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: closing the drawer on every pathname change is the desired behaviour.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: react to a route change by collapsing the drawer.
    setOpen(false);
  }, [pathname]);

  const value = React.useMemo<DrawerContextValue>(() => ({ open, setOpen }), [open]);
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

function useDrawer(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) {
    throw new Error('MobileDrawer components must be used inside MobileDrawerProvider');
  }
  return ctx;
}

export function MobileDrawerTrigger({ className }: { className?: string }) {
  const { setOpen } = useDrawer();
  return (
    <button
      type="button"
      aria-label="Open navigation menu"
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-button border border-border-soft bg-white text-ink-mid transition-colors hover:bg-foam hover:text-forest-600 lg:hidden',
        className,
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useDrawer();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col border-r border-border-soft bg-white text-ink shadow-(--shadow-modal) duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
          aria-label="Site navigation"
        >
          <DialogPrimitive.Title className="sr-only">Tenantly navigation</DialogPrimitive.Title>
          <div className="absolute right-2 top-2 z-10">
            <DialogPrimitive.Close
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-mid hover:bg-foam hover:text-forest-600"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
