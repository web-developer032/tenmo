import { redirect } from 'next/navigation';
import { MessagesView } from '@/features/messaging/components/messages-view';
import { loadConversationParticipants, loadInbox, loadThread } from '@/features/messaging/loaders';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * `/messages/[id]` — inbox + the active thread. Server-renders inbox,
 * thread, and the participant snapshot so sender names and read-receipt
 * ticks are correct on first paint.
 */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/messages/${id}`);

  const [inbox, thread, participants] = await Promise.all([
    loadInbox(),
    loadThread(id),
    loadConversationParticipants(id),
  ]);

  return (
    <MessagesView
      userId={user.id}
      initialInbox={inbox}
      initialThread={thread}
      initialParticipants={participants}
      activeId={id}
    />
  );
}
