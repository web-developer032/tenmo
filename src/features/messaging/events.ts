'use client';

/**
 * Same-tab cross-component messaging events.
 *
 * Why this exists: when the conversation thread marks itself read, peer
 * components in the same tab (the inbox sidebar, the inbox icon, the
 * notifications bell) need to refresh *immediately* — waiting for a
 * Postgres → Realtime → fetch round-trip is visible jank.
 *
 * Implementation is a thin wrapper around `window.CustomEvent`. It runs
 * only on the client (the `'use client'` directive guards SSR), and the
 * listener helpers are no-ops in non-browser environments so they're safe
 * to call from React effects without `typeof window` checks at every
 * site.
 */

/** Custom event types we emit on the global `window`. */
export const MESSAGING_READ_EVENT = 'tenantly:messaging:read' as const;

export type MessagingReadDetail = {
  /** The conversation that was just marked read. */
  conversationId: string;
};

/**
 * Dispatch a `messaging:read` event on the window. Safe to call during
 * render / effects — no-ops on the server.
 */
export function dispatchMessagingRead(conversationId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MessagingReadDetail>(MESSAGING_READ_EVENT, {
      detail: { conversationId },
    }),
  );
}

/**
 * Subscribe to `messaging:read` events. Returns an unsubscribe function;
 * call from a React `useEffect` cleanup.
 *
 * The handler receives the conversation id; if the listener cares about
 * a specific conversation it can filter, otherwise treat any event as
 * "something just got read — refresh".
 */
export function subscribeMessagingRead(handler: (conversationId: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<MessagingReadDetail>).detail;
    if (!detail?.conversationId) return;
    handler(detail.conversationId);
  };
  window.addEventListener(MESSAGING_READ_EVENT, onEvent as EventListener);
  return () => {
    window.removeEventListener(MESSAGING_READ_EVENT, onEvent as EventListener);
  };
}
