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

const KIND_TONE: Record<NotificationKind, string> = {
  compliance_due: 'text-warning',
  compliance_overdue: 'text-destructive',
  compliance_doc_uploaded: 'text-foreground',
  rent_charged: 'text-foreground',
  rent_paid: 'text-success',
  rent_failed: 'text-destructive',
  bill_added: 'text-foreground',
  mandate_active: 'text-success',
  mandate_failed: 'text-destructive',
  passport_exported: 'text-foreground',
  ast_sent: 'text-foreground',
  ast_signed: 'text-success',
  ast_declined: 'text-destructive',
  ast_expired: 'text-warning',
  ticket_created: 'text-foreground',
  ticket_message: 'text-foreground',
  ticket_status_changed: 'text-foreground',
  ticket_assigned: 'text-foreground',
  tenancy_invited: 'text-foreground',
  tenancy_accepted: 'text-success',
  tenancy_ended: 'text-muted-foreground',
  tenancy_doc_uploaded: 'text-foreground',
  message_received: 'text-foreground',
  subscription_past_due: 'text-destructive',
  listing_published: 'text-foreground',
  application_received: 'text-foreground',
  application_accepted: 'text-success',
  application_rejected: 'text-muted-foreground',
  application_withdrawn: 'text-muted-foreground',
  system: 'text-muted-foreground',
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
  const tone = KIND_TONE[notification.kind] ?? 'text-muted-foreground';
  const rule = NOTIFICATION_KIND_RULES[notification.kind];
  const groupLabel = NOTIFICATION_GROUP_LABEL[rule.group];
  const isUnread = !notification.read_at;
  const Wrapper = onClick ? 'button' : 'div';

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
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted',
          tone,
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
        {notification.body && !compact ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        ) : notification.body ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{notification.body}</p>
        ) : null}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{groupLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{relativeTimeShort(notification.created_at)}</span>
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
    </Wrapper>
  );
}
