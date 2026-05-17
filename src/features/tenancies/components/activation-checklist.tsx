import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ActivationBlocker,
  type ActivationBlockerCode,
  type ActivationInputs,
  deriveActivationBlockers,
} from '@/core/utils/tenancy-activation';

/**
 * Reusable activation checklist. Pure RSC — feed it the activation
 * inputs (the page that loads the tenancy already has all of them)
 * and it renders the same view the server will evaluate.
 */
export function TenancyActivationChecklist({ input }: { input: ActivationInputs }) {
  const decision = deriveActivationBlockers(input);
  const blockerSet = new Set<ActivationBlockerCode>(decision.blockers.map((b) => b.code));
  const items: Array<{ code: ActivationBlockerCode; label: string }> = [
    { code: 'tenant_not_accepted', label: 'Tenant accepted invite' },
    { code: 'rtr_not_current', label: 'Right to Rent check is current' },
    { code: 'ast_not_signed', label: 'Tenancy agreement (AST) signed' },
    { code: 'deposit_not_protected', label: 'Deposit registered with a scheme' },
    { code: 'start_date_in_future', label: 'Start date reached' },
  ];

  return (
    <Card className={decision.canActivate ? 'border-emerald-500/40' : undefined}>
      <CardHeader>
        <CardTitle className="text-base">
          {decision.canActivate ? 'Ready to activate' : 'Activation checklist'}
        </CardTitle>
        <CardDescription>
          {decision.canActivate
            ? 'All prerequisites met. The tenancy will activate on the next system check.'
            : 'A tenancy moves to active when all of the items below are checked.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const done = !blockerSet.has(item.code);
          return (
            <div
              key={item.code}
              className="flex items-start gap-2 text-sm"
              data-testid={`activation-blocker-${item.code}`}
            >
              {done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <span className={done ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export type { ActivationBlocker };
