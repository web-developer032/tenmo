'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/*
 * Forest-themed Sonner toaster.
 *
 * Background is forest (the design uses #0F6E56 with `--shadow-toast`),
 * radius is 12 px, and the description text fades to a softer mint so the
 * primary line dominates. Rich-color variants (success/info/warning/error)
 * use semantic forest/blue/amber/alert tokens that already exist in
 * `globals.css`.
 */
export function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-forest-600 group-[.toaster]:text-white group-[.toaster]:border-0 group-[.toaster]:rounded-[12px] group-[.toaster]:shadow-[var(--shadow-toast)] group-[.toaster]:font-body group-[.toaster]:text-[13px]',
          title: 'group-[.toast]:font-sans group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-white/80',
          actionButton:
            'group-[.toast]:bg-white group-[.toast]:text-forest-600 group-[.toast]:font-semibold group-[.toast]:rounded-[var(--radius-button)]',
          cancelButton:
            'group-[.toast]:bg-white/15 group-[.toast]:text-white group-[.toast]:rounded-[var(--radius-button)]',
          success: 'group-[.toaster]:bg-forest-600 group-[.toaster]:text-white',
          error: 'group-[.toaster]:bg-alert group-[.toaster]:text-white',
          warning: 'group-[.toaster]:bg-amber group-[.toaster]:text-white',
          info: 'group-[.toaster]:bg-blue group-[.toaster]:text-white',
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
