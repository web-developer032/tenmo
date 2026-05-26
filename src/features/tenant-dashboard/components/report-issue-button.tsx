'use client';

import { Pencil, Plus } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NewTicketForm, type TenancyOption } from '@/features/tickets/components/new-ticket-form';

/*
 * "Report an issue" CTA — opens the standard `NewTicketForm` inside a
 * `Dialog`. We delegate the form behaviour (triage, submit, redirect)
 * entirely to `NewTicketForm`; this component is just the
 * button + modal wrapper used on the Home and Maintenance pages.
 */

export type ReportIssueButtonProps = {
  tenancies: TenancyOption[];
  redirectBase: string;
  /** Visual variant. `primary` = forest filled, `ghost` = outline. */
  variant?: 'primary' | 'ghost';
  /** Optional override label. Defaults to "Report an issue". */
  label?: string;
  /** Optional Tailwind classes for the trigger. */
  className?: string;
};

export function ReportIssueButton({
  tenancies,
  redirectBase,
  variant = 'primary',
  label = 'Report an issue',
  className,
}: ReportIssueButtonProps) {
  const [open, setOpen] = React.useState(false);

  if (tenancies.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant === 'primary' ? 'default' : 'outline'}
          size="sm"
          className={className}
        >
          <Plus className="h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-forest-600" />
            Report a maintenance issue
          </DialogTitle>
          <DialogDescription>
            Tell your landlord what&apos;s going on. Be specific — when did it start, how often does
            it happen, and is it dangerous?
          </DialogDescription>
        </DialogHeader>
        <NewTicketForm tenancies={tenancies} redirectBase={redirectBase} />
      </DialogContent>
    </Dialog>
  );
}
