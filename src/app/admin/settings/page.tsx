import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ds/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminBanner } from '@/features/admin/components/ds/admin-banner';
import { PlatformSettingsForm } from '@/features/admin/components/platform-settings-form';
import { getAdminSelf, getPlatformSettingsWithClient, hasAdminRole } from '@/features/admin/server';
import { getServerEnv } from '@/lib/env.server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * /admin/settings — platform-wide configuration.
 *
 * Read by every admin; only super admins can write (enforced both
 * here and by RLS). Four cards (plan pricing, email config,
 * compliance thresholds, integrations status) — the first three are
 * editable via a single form; integrations status is computed from
 * env-presence checks.
 */
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin/settings');

  const self = await getAdminSelf(supabase, user.id);
  const canEdit = hasAdminRole(self, ['super']);
  const settings = await getPlatformSettingsWithClient(supabase);

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Platform settings' }]}
        title="Platform settings"
        description="Pricing, email, integrations and compliance thresholds — applied globally."
      />

      {!canEdit ? (
        <AdminBanner
          tone="info"
          title="Read-only access"
          description="You're signed in as a non-super admin. Settings can be viewed but not edited."
        />
      ) : null}

      <PlatformSettingsForm initial={settings} canEdit={canEdit} />

      <IntegrationsCard />
    </div>
  );
}

function IntegrationsCard() {
  const env = getServerEnv();
  const items: {
    name: string;
    subtitle: string;
    status: 'connected' | 'disconnected' | 'optional';
  }[] = [
    {
      name: 'Stripe',
      subtitle: 'Subscription billing',
      status: env.STRIPE_SECRET_KEY ? 'connected' : 'disconnected',
    },
    {
      name: 'GoCardless',
      subtitle: 'Direct debit rent collection',
      status: env.GOCARDLESS_ACCESS_TOKEN ? 'connected' : 'optional',
    },
    {
      name: 'TrueLayer',
      subtitle: 'Open-banking bank ingest',
      status: env.TRUELAYER_CLIENT_ID ? 'connected' : 'optional',
    },
    {
      name: 'Resend (email)',
      subtitle: 'Transactional + notification emails',
      status: env.RESEND_API_KEY ? 'connected' : 'disconnected',
    },
    {
      name: 'Supabase',
      subtitle: 'Auth, database and storage',
      status: env.SUPABASE_SERVICE_ROLE_KEY ? 'connected' : 'disconnected',
    },
    {
      name: 'Sentry',
      subtitle: 'Error reporting',
      status: env.SENTRY_AUTH_TOKEN ? 'connected' : 'optional',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.map((i) => (
          <div
            key={i.name}
            className="flex items-center justify-between gap-3 rounded-button bg-bg-page px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-semibold text-ink">{i.name}</div>
              <div className="text-[11.5px] text-ink-light">{i.subtitle}</div>
            </div>
            <IntegrationBadge status={i.status} />
          </div>
        ))}
        <p className="pt-1 text-[11.5px] text-ink-light">
          Integration credentials are managed via environment variables — flipping these on/off
          requires a deploy, not a settings change.
        </p>
      </CardContent>
    </Card>
  );
}

function IntegrationBadge({ status }: { status: 'connected' | 'disconnected' | 'optional' }) {
  if (status === 'connected') return <Badge variant="success">Connected</Badge>;
  if (status === 'disconnected') return <Badge variant="urgent">Disconnected</Badge>;
  return <Badge variant="neutral">Not configured</Badge>;
}
