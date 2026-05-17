import { Receipt } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TenantBillRow as TenantBillData } from '../loaders';
import { TenantBillRow } from './tenant-bill-row';

/**
 * Tenant-facing bills summary card. Server component; the parent
 * page loads the rows and passes them in.
 */
export function TenantBillsCard({ bills }: { bills: ReadonlyArray<TenantBillData> }) {
  if (bills.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Shared bills
          </CardTitle>
          <CardDescription>
            Your landlord has not added any shared bills for your room yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Shared bills
        </CardTitle>
        <CardDescription>
          Your share of utilities, council tax and other shared costs. Informational — bills are
          paid via your landlord, not through Tenantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {bills.map((b) => (
          <TenantBillRow
            key={`${b.bill_id}`}
            type={b.bill_type}
            period_start={b.period_start}
            period_end={b.period_end}
            amount_pence={b.amount_pence}
            allocation_method={b.allocation_method}
          />
        ))}
      </CardContent>
    </Card>
  );
}
