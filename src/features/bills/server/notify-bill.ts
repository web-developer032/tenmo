import 'server-only';
import { BILL_TYPE_LABEL, type BillType } from '@/core/constants/bills';
import { formatMoney } from '@/core/utils/money';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';

/**
 * Best-effort tenant notification for "new bill added".
 *
 * Mirrors the Phase L `notify-ast.ts` style — every call is wrapped
 * in a try/catch so notification failures never block the underlying
 * landlord action.
 */

const log = () => getLogger().child({ module: 'bills.notify' });

export async function notifyTenantsOfBill(args: {
  bill_id: string;
  bill_type: BillType;
  property_id: string;
  recipients: ReadonlyArray<{ user_id: string; amount_pence: number }>;
}): Promise<void> {
  for (const r of args.recipients) {
    try {
      await publishNotification({
        user_id: r.user_id,
        kind: 'bill_added',
        title: 'New shared bill',
        body: `Your share of the ${BILL_TYPE_LABEL[args.bill_type].toLowerCase()} bill is ${formatMoney(r.amount_pence)}.`,
        link_url: `/tenant/bills`,
        entity_type: 'bill',
        entity_id: args.bill_id,
      });
    } catch (err) {
      log().warn({ err, user_id: r.user_id }, 'bill notification fan-out failed');
    }
  }
}
