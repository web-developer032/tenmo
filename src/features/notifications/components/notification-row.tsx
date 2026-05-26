'use client';

import {
  AlertTriangle,
  Banknote,
  Bell,
  BookUser,
  Building2,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  FileSignature,
  FileText,
  Landmark,
  Mail,
  MessageSquare,
  Search,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from 'lucide-react';
import type * as React from 'react';
import {
  NOTIFICATION_GROUP_LABEL,
  NOTIFICATION_KIND_RULES,
  type NotificationKind,
} from '@/core/constants/notifications';
import type { Notification } from '@/core/schemas/notification';
import { relativeTimeShort } from '@/core/utils/dates';
import { cn } from '@/lib/cn';

/**
 * Visual building block shared between the bell dropdown and the full
 * `/notifications` feed page. Pure: parents own click handling and
 * mark-read state.
 */

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  compliance_due: ShieldAlert,
  compliance_overdue: ShieldAlert,
  compliance_doc_uploaded: FileText,
  rent_charged: Banknote,
  rent_paid: CheckCircle2,
  rent_failed: AlertTriangle,
  bill_added: Banknote,
  mandate_active: Landmark,
  mandate_failed: AlertTriangle,
  passport_exported: BookUser,
  ast_sent: FileSignature,
  ast_signed: FileSignature,
  ast_declined: AlertTriangle,
  ast_expired: FileSignature,
  ticket_created: Wrench,
  ticket_message: Wrench,
  ticket_status_changed: Wrench,
  ticket_assigned: Wrench,
  tenancy_invited: Building2,
  tenancy_accepted: Building2,
  tenancy_ended: Building2,
  tenancy_doc_uploaded: FileText,
  message_received: MessageSquare,
  subscription_past_due: CreditCard,
  listing_published: DoorOpen,
  application_received: Search,
  application_accepted: ThumbsUp,
  application_rejected: ThumbsDown,
  application_withdrawn: DoorOpen,
  system: Bell,
};

/**
 * Tinted icon tiles (background + icon colour) from the HMOeez design's
 * `.notif-icon` pattern. We map every notification kind to one of four
 * tones — forest (informational / success), amber (heads-up / scheduled),
 * alert (urgent / failed), and ink (neutral / system).
 */
const KIND_TONE: Record<NotificationKind, { bg: string; fg: string; legacyText: string }> = {
  compliance_due: { bg: 'bg-amber-100', fg: 'text-amber-700', legacyText: 'text-warning' },
  compliance_overdue: { bg: 'bg-rose-100', fg: 'text-rose-700', legacyText: 'text-destructive' },
  compliance_doc_uploaded: {
    bg: 'bg-forest-100',
    fg: 'text-forest-700',
    legacyText: 'text-foreground',
  },
  rent_charged: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-foreground' },
  rent_paid: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-success' },
  rent_failed: { bg: 'bg-rose-100', fg: 'text-rose-700', legacyText: 'text-destructive' },
  bill_added: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-foreground' },
  mandate_active: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-success' },
  mandate_failed: { bg: 'bg-rose-100', fg: 'text-rose-700', legacyText: 'text-destructive' },
  passport_exported: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-foreground' },
  ast_sent: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-foreground' },
  ast_signed: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-success' },
  ast_declined: { bg: 'bg-rose-100', fg: 'text-rose-700', legacyText: 'text-destructive' },
  ast_expired: { bg: 'bg-amber-100', fg: 'text-amber-700', legacyText: 'text-warning' },
  ticket_created: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-foreground' },
  ticket_message: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-foreground' },
  ticket_status_changed: {
    bg: 'bg-forest-100',
    fg: 'text-forest-700',
    legacyText: 'text-foreground',
  },
  ticket_assigned: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-foreground' },
  tenancy_invited: { bg: 'bg-amber-100', fg: 'text-amber-700', legacyText: 'text-foreground' },
  tenancy_accepted: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-success' },
  tenancy_ended: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-muted-foreground' },
  tenancy_doc_uploaded: {
    bg: 'bg-forest-100',
    fg: 'text-forest-700',
    legacyText: 'text-foreground',
  },
  message_received: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-foreground' },
  subscription_past_due: { bg: 'bg-rose-100', fg: 'text-rose-700', legacyText: 'text-destructive' },
  listing_published: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-foreground' },
  application_received: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-foreground' },
  application_accepted: { bg: 'bg-forest-100', fg: 'text-forest-700', legacyText: 'text-success' },
  application_rejected: {
    bg: 'bg-stone-100',
    fg: 'text-stone-700',
    legacyText: 'text-muted-foreground',
  },
  application_withdrawn: {
    bg: 'bg-stone-100',
    fg: 'text-stone-700',
    legacyText: 'text-muted-foreground',
  },
  system: { bg: 'bg-stone-100', fg: 'text-stone-700', legacyText: 'text-muted-foreground' },
};

export type NotificationRowProps = {
  notification: Notification;
  onClick?: (n: Notification) => void;
  /** When true, shows a compact layout for the bell dropdown. */
  compact?: boolean;
  className?: string;
};

export function NotificationRow({
  notification,
  onClick,
  compact = false,
  className,
}: NotificationRowProps) {
  const Icon = KIND_ICON[notification.kind] ?? Bell;
  const toneEntry = KIND_TONE[notification.kind] ?? {
    bg: 'bg-stone-100',
    fg: 'text-stone-700',
    legacyText: 'text-muted-foreground',
  };
  const rule = NOTIFICATION_KIND_RULES[notification.kind];
  const groupLabel = NOTIFICATION_GROUP_LABEL[rule.group];
  const isUnread = !notification.read_at;
  const Wrapper = onClick ? 'button' : 'div';

  // Compact (bell-dropdown) layout — keep the legacy condensed pill so the
  // dropdown stays scannable. Full-feed rows use the redesigned layout
  // matching `design/tenant-dashboard.html#notif-item`.
  if (compact) {
    return (
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick ? () => onClick(notification) : undefined}
        className={cn(
          'group flex w-full gap-3 px-3 py-2.5 text-left transition-colors',
          onClick && 'cursor-pointer hover:bg-accent/60 focus:bg-accent/60 focus:outline-none',
          isUnread && 'bg-accent/20',
          className,
        )}
        aria-label={notification.title}
      >
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            toneEntry.bg,
            toneEntry.fg,
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                'flex-1 truncate text-sm',
                isUnread ? 'font-semibold text-foreground' : 'text-foreground/90',
              )}
            >
              {notification.title}
            </p>
            {isUnread ? (
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                role="status"
                aria-label="Unread"
              />
            ) : null}
          </div>
          {notification.body ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{notification.body}</p>
          ) : null}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{groupLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{relativeTimeShort(notification.created_at)}</span>
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(notification) : undefined}
      className={cn(
        'group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
        onClick && 'cursor-pointer hover:bg-stone-50 focus:bg-stone-50 focus:outline-none',
        className,
      )}
      aria-label={notification.title}
    >
      <span
        className={cn(
          'mt-1 h-2 w-2 shrink-0 rounded-full',
          isUnread ? 'bg-forest-600' : 'bg-transparent',
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          toneEntry.bg,
          toneEntry.fg,
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'text-[13px] leading-snug',
            isUnread ? 'font-semibold text-ink' : 'font-medium text-ink/90',
          )}
        >
          {notification.title}
        </div>
        {notification.body ? (
          <div className="mt-0.5 line-clamp-2 text-[12px] text-ink-light">{notification.body}</div>
        ) : null}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-light">
          <span>{groupLabel}</span>
          {notification.delivered_email_at ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" /> emailed
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 pt-0.5 text-[11px] text-ink-light">
        {relativeTimeShort(notification.created_at)}
      </div>
    </Wrapper>
  );
}
