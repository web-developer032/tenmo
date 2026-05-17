import type { NextRequest } from 'next/server';
import { sendComplianceReminders } from '@/features/compliance/server';
import { authenticateCron } from '@/lib/cron-auth';
import { getLogger } from '@/lib/logger';

/**
 * Daily compliance reminder cron.
 *
 * Wired in `vercel.json` to run at 09:00 UTC every day. On Vercel the
 * platform sends `Authorization: Bearer <CRON_SECRET>`; locally you can
 * trigger manually:
 *
 *     curl -X POST http://localhost:3000/api/cron/compliance-reminders
 *
 * The route is idempotent — duplicate calls won't double-send because
 * `compliance_reminders` has a unique index on (item, channel, days_before).
 */
export const dynamic = 'force-dynamic';

async function run(req: NextRequest): Promise<Response> {
  const auth = authenticateCron(req);
  if (!auth.ok) {
    return Response.json(
      { error: { code: 'unauthorized', message: auth.reason } },
      { status: auth.status },
    );
  }

  const log = getLogger().child({ route: '/api/cron/compliance-reminders' });
  try {
    const result = await sendComplianceReminders();
    return Response.json({ data: result });
  } catch (err) {
    log.error({ err }, 'compliance reminders cron failed');
    return Response.json(
      { error: { code: 'internal_error', message: 'Cron run failed' } },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;
