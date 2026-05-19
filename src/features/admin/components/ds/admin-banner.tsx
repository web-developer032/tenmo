import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Admin alert / warning / info banner from the HMOeez mock's
 * `.alert-banner` / `.warn-banner` / `.info-banner` patterns.
 *
 * Single component, four tones. Server-renderable.
 */

export type AdminBannerTone = 'alert' | 'warn' | 'info' | 'success';

const TONE: Record<
  AdminBannerTone,
  { wrap: string; border: string; icon: React.ReactNode; title: string }
> = {
  alert: {
    wrap: 'bg-alert-bg',
    border: 'border-l-alert',
    icon: <AlertTriangle className="h-5 w-5 text-alert" />,
    title: 'text-alert',
  },
  warn: {
    wrap: 'bg-amber-bg',
    border: 'border-l-amber',
    icon: <AlertTriangle className="h-5 w-5 text-amber" />,
    title: 'text-amber',
  },
  info: {
    wrap: 'bg-foam',
    border: 'border-l-forest-600',
    icon: <Info className="h-5 w-5 text-forest-600" />,
    title: 'text-forest-700',
  },
  success: {
    wrap: 'bg-foam',
    border: 'border-l-forest-600',
    icon: <CheckCircle2 className="h-5 w-5 text-forest-600" />,
    title: 'text-forest-700',
  },
};

export type AdminBannerProps = {
  tone: AdminBannerTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function AdminBanner({ tone, title, description, actions, className }: AdminBannerProps) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border-l-4 px-4 py-3',
        t.wrap,
        t.border,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[13px] font-bold', t.title)}>{title}</div>
        {description ? (
          <div className="mt-0.5 text-[12px] leading-relaxed text-ink-mid">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
