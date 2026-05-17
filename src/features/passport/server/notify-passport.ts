import 'server-only';
import { publishNotification } from '@/features/notifications/server';
import { getLogger } from '@/lib/logger';

/**
 * Best-effort in-app receipt for a Rental Passport export. Wrapped
 * so a notifications-service blip never bricks a passport download.
 */
const log = () => getLogger().child({ module: 'passport.notify' });

export async function notifyPassportExported(args: {
  user_id: string;
  export_id: string;
}): Promise<void> {
  try {
    await publishNotification({
      user_id: args.user_id,
      kind: 'passport_exported',
      title: 'Rental Passport exported',
      body: 'Your Rental Passport PDF is ready to download. Find it in your passport history.',
      link_url: '/tenant/passport',
      entity_type: 'passport_export',
      entity_id: args.export_id,
    });
  } catch (err) {
    log().warn({ err, user_id: args.user_id }, 'passport notification failed');
  }
}
