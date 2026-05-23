import { redirect } from "next/navigation";
import { readRememberedWorkspace } from "@/features/app-shell/server";
import { MessagesView } from "@/features/messaging/components/messages-view";
import {
  loadConversationParticipants,
  loadInbox,
  loadThread,
} from "@/features/messaging/loaders";
import {
  listMessageCandidates,
  type MessageCandidate,
} from "@/features/messaging/server";
import { loadRoleAvailability } from "@/features/role-switcher/loader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * `/messages/[id]` — inbox + the active thread. Server-renders inbox,
 * thread, and the participant snapshot so sender names and read-receipt
 * ticks are correct on first paint.
 *
 * Also pre-loads the "New message" candidate list when the caller is
 * inside a landlord workspace so the compose button stays usable from
 * inside a thread.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/messages/${id}`);

  const [inbox, thread, participants, workspace, availability] =
    await Promise.all([
      loadInbox(),
      loadThread(id),
      loadConversationParticipants(id),
      readRememberedWorkspace(),
      loadRoleAvailability(),
    ]);

  let composeOrgId: string | null = null;
  let composeCandidates: MessageCandidate[] = [];
  if (workspace?.kind === "landlord") {
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
      initialThread={thread}
      initialParticipants={participants}
      activeId={id}
      composeOrgId={composeOrgId}
      composeCandidates={composeCandidates}
    />
  );
}
