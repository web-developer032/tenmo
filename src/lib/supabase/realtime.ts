import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Return a fresh `RealtimeChannel` for `topic`, removing any previously
 * registered channel that already owns the same topic.
 *
 * Why this exists:
 *   `@supabase/ssr`'s `createBrowserClient` memoises a single Supabase
 *   client per browser tab, so every hook (and every mount of every
 *   hook) shares one realtime channel registry. Recent `supabase-js`
 *   versions return the EXISTING channel when you call `channel(topic)`
 *   with a topic that's already registered. If that existing channel
 *   has already been `.subscribe()`-d (very likely — two components
 *   subscribing to `notifications:<userId>` at once, or React 19 /
 *   StrictMode running the new effect before the old cleanup's async
 *   `removeChannel` settles, or Next.js HMR keeping the old channel
 *   alive across module reload), then the next `.on('postgres_changes',
 *   …)` throws:
 *
 *     Error: cannot add `postgres_changes` callbacks for
 *            realtime:<topic> after `subscribe()`.
 *
 * Use this helper for any channel keyed on stable per-user /
 * per-conversation IDs where there's a realistic chance of a duplicate
 * subscription on the same tab.
 *
 * Don't use it for Supabase Realtime *broadcast* channels (e.g. the
 * typing indicator) — those rely on peers sharing the exact same topic
 * and you genuinely want to attach to whatever channel already exists.
 */
export function freshRealtimeChannel(
  supabase: SupabaseClient,
  topic: string,
  opts?: Parameters<SupabaseClient['channel']>[1],
): RealtimeChannel {
  const wireTopic = `realtime:${topic}`;
  for (const existing of supabase.getChannels()) {
    if (existing.topic === wireTopic) {
      void supabase.removeChannel(existing);
    }
  }
  return opts ? supabase.channel(topic, opts) : supabase.channel(topic);
}
