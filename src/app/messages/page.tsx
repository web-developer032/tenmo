import { redirect } from 'next/navigation';
import { MessagesView } from '@/features/messaging/components/messages-view';
import { loadInbox } from '@/features/messaging/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/messages` — inbox + empty thread placeholder. Server-renders the
 * conversation list (RLS-scoped) so the page is useful on first paint.
 */
export default async function MessagesIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/messages');

  const inbox = await loadInbox();

  return <MessagesView userId={user.id} initialInbox={inbox} />;
}
