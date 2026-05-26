import { redirect } from 'next/navigation';
import { readRememberedWorkspace } from '@/features/app-shell/server';
import { MessagesView } from '@/features/messaging/components/messages-view';
import { loadInbox } from '@/features/messaging/loaders';
import { listMessageCandidates, type MessageCandidate } from '@/features/messaging/server';
import { loadRoleAvailability } from '@/features/role-switcher/loader';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/messages` — inbox + empty thread placeholder. Server-renders the
 * conversation list (RLS-scoped) so the page is useful on first paint.
 *
 * When the caller is currently inside a landlord workspace (cookie
 * `tly-workspace`) we also pre-load the candidate list for the
 * "New message" dialog so it opens with zero latency.
 */
export default async function MessagesIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messages');

  const [inbox, workspace, availability] = await Promise.all([
    loadInbox(),
    readRememberedWorkspace(),
    loadRoleAvailability(),
  ]);

  let composeOrgId: string | null = null;
  let composeCandidates: MessageCandidate[] = [];
  if (workspace?.kind === 'landlord') {
    const org = availability.orgs.find((o) => o.slug === workspace.slug);
    if (org) {
      composeOrgId = org.id;
      try {
        composeCandidates = await listMessageCandidates(supabase, {
          orgId: org.id,
          excludeUserId: user.id,
        });
      } catch {
        composeCandidates = [];
      }
    }
  }

  return (
    <MessagesView
      userId={user.id}
      initialInbox={inbox}
      composeOrgId={composeOrgId}
      composeCandidates={composeCandidates}
    />
  );
}
