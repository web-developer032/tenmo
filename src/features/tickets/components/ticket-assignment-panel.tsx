'use client';

import { Loader2, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export type OrgMemberOption = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
  role: string;
};

/**
 * Landlord-only assignment panel.
 *
 * Two assignment paths in one card:
 *   - Pick a team member (`assigned_to_user_id`) — exclusive of contractor
 *   - Or type a free-text contractor name (`assigned_contractor`)
 *
 * The server will clear the other field on save, so the UI keeps the two
 * inputs visually grouped but lets you switch freely.
 */
export function TicketAssignmentPanel({
  ticketId,
  members,
  currentUserId,
  currentContractor,
}: {
  ticketId: string;
  members: OrgMemberOption[];
  currentUserId: string | null;
  currentContractor: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [contractor, setContractor] = React.useState(currentContractor ?? '');

  const submit = async (payload: {
    assigned_to_user_id?: string | null;
    assigned_contractor?: string | null;
  }) => {
    setPending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.data) {
        toast.error(json?.error?.message ?? 'Could not update assignment');
        return;
      }
      toast.success('Assignment updated');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const currentMember = currentUserId ? members.find((m) => m.id === currentUserId) : null;
  const isAssignedToContractor = !!currentContractor && !currentUserId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <UserPlus className="h-3.5 w-3.5" />
          Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="space-y-1.5">
          <p className="text-muted-foreground">Currently:</p>
          {currentMember ? (
            <p className="font-medium">
              {currentMember.full_name ?? currentMember.contact_email ?? 'Team member'}
              <span className="ml-1 text-muted-foreground">({currentMember.role})</span>
            </p>
          ) : isAssignedToContractor ? (
            <p className="font-medium">{currentContractor}</p>
          ) : (
            <p className="text-muted-foreground italic">Unassigned</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground" htmlFor="assignee-select">
            Team member
          </label>
          <select
            id="assignee-select"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={currentUserId ?? ''}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value || null;
              submit({ assigned_to_user_id: v, assigned_contractor: null });
            }}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name ?? m.contact_email ?? 'Member'} · {m.role}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground" htmlFor="contractor-input">
            Or external contractor
          </label>
          <div className="flex gap-1">
            <Input
              id="contractor-input"
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="e.g. Acme Plumbing Ltd"
              maxLength={140}
              className="h-9 text-xs"
              disabled={pending}
            />
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={
                pending || contractor.trim().length === 0 || contractor === currentContractor
              }
              onClick={() =>
                submit({
                  assigned_to_user_id: null,
                  assigned_contractor: contractor.trim(),
                })
              }
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
          {currentContractor ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={pending}
              onClick={() => {
                setContractor('');
                submit({ assigned_to_user_id: null, assigned_contractor: null });
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Clear contractor
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
