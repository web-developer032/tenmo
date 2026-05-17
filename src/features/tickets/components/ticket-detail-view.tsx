import { CalendarClock, Clock, Hash, Home, MapPin, Sparkles, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TICKET_CATEGORY_RULES } from '@/core/constants/tickets';
import { firstResponseSla, resolutionSla, type TicketActorRole } from '@/core/utils/ticket-rules';
import { cn } from '@/lib/cn';
import type { TicketDetailData } from '../loaders';
import { ticketSeverityDisplay, ticketStatusDisplay } from '../status-display';
import { TicketMessageForm } from './ticket-message-form';
import { TicketMessageList } from './ticket-message-list';
import { TicketStatusActions } from './ticket-status-actions';

/**
 * Shared ticket detail layout for both tenant and landlord pages.
 *
 * Layout:
 *   [ Hero card: title, severity, status, category, property/room, SLA chips ]
 *   [ Description (first message) ]
 *   [ Status actions for the caller's role ]
 *   [ Message timeline ]
 *   [ Reply form ]
 *
 * The same component renders for both roles — what's allowed/visible is
 * driven by the `actorRole` and `extraSidebar` props. The reply form and
 * timeline always render (both sides can comment).
 */
export function TicketDetailView({
  data,
  actorRole,
  currentUserId,
  extraSidebar,
}: {
  data: TicketDetailData;
  actorRole: TicketActorRole;
  currentUserId: string | null;
  /** Optional extra sidebar content (e.g. landlord assignment panel). */
  extraSidebar?: React.ReactNode;
}) {
  const { ticket, messages, authors } = data;
  const status = ticketStatusDisplay(ticket.status);
  const severity = ticketSeverityDisplay(ticket.severity);
  const category = TICKET_CATEGORY_RULES[ticket.category];
  const fr = firstResponseSla(ticket);
  const res = resolutionSla(ticket);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                  severity.tone,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', severity.dot)} aria-hidden />
                {severity.label}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  status.tone,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden />
                {status.label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                {ticket.id.slice(0, 8)}
              </span>
            </div>
            <CardTitle className="text-xl md:text-2xl">{ticket.title}</CardTitle>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Home className="h-3 w-3" />
                {ticket.property_name ?? 'Property'}
                {ticket.room_name ? ` · ${ticket.room_name}` : ''}
              </span>
              <span aria-hidden>·</span>
              <span>{category.label}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                Raised {formatDate(ticket.created_at)}
              </span>
            </p>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TicketMessageList
              messages={messages}
              authors={authors}
              currentUserId={currentUserId}
            />
            <Separator />
            <TicketMessageForm ticketId={ticket.id} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketStatusActions
              ticketId={ticket.id}
              currentStatus={ticket.status}
              actorRole={actorRole}
            />
          </CardContent>
        </Card>

        {ticket.ai_suggested_category || ticket.ai_triage_reason ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Triage hint
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              {ticket.ai_suggested_category ? (
                <p>
                  Suggested category:{' '}
                  <strong>{TICKET_CATEGORY_RULES[ticket.ai_suggested_category].label}</strong>
                </p>
              ) : null}
              {ticket.ai_suggested_severity ? (
                <p>
                  Suggested severity: <strong>{ticket.ai_suggested_severity}</strong>
                </p>
              ) : null}
              {ticket.ai_triage_reason ? <p>{ticket.ai_triage_reason}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <Row icon={<CalendarClock className="h-3 w-3" />} label="Raised">
              {formatDate(ticket.created_at)}
            </Row>
            {ticket.first_response_at ? (
              <Row icon={<Clock className="h-3 w-3" />} label="First response">
                {formatDate(ticket.first_response_at)}
              </Row>
            ) : fr ? (
              <Row icon={<Clock className="h-3 w-3" />} label="First response">
                <span className={slaTone(fr.level)}>
                  {fr.level === 'breached'
                    ? `${Math.round(-fr.remainingHours)}h overdue`
                    : `due in ~${Math.max(0, Math.round(fr.remainingHours))}h`}
                </span>
              </Row>
            ) : null}
            {ticket.resolved_at ? (
              <Row icon={<Clock className="h-3 w-3" />} label="Resolved">
                {formatDate(ticket.resolved_at)}
              </Row>
            ) : res ? (
              <Row icon={<Clock className="h-3 w-3" />} label="Resolution target">
                <span className={slaTone(res.level)}>
                  {res.level === 'breached'
                    ? `${Math.round(-res.remainingHours)}h overdue`
                    : `~${Math.max(0, Math.round(res.remainingHours))}h left`}
                </span>
              </Row>
            ) : null}
            {ticket.reopened_count > 0 ? (
              <Row icon={<Clock className="h-3 w-3" />} label="Reopened">
                {ticket.reopened_count}× since first raised
              </Row>
            ) : null}
          </CardContent>
        </Card>

        {extraSidebar}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {ticket.property_name ?? 'Property'}
              {ticket.room_name ? ` · ${ticket.room_name}` : ''}
            </p>
            {actorRole === 'landlord' && (ticket.tenant_name || ticket.tenant_email) ? (
              <p className="inline-flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {ticket.tenant_name ?? ticket.tenant_email}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function slaTone(level: 'on_track' | 'approaching' | 'breached'): string {
  if (level === 'breached') return 'text-red-700 dark:text-red-300 font-medium';
  if (level === 'approaching') return 'text-amber-700 dark:text-amber-300 font-medium';
  return 'text-emerald-700 dark:text-emerald-300';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
