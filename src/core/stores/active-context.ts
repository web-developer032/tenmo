import { create } from 'zustand';
import type { ActiveContext } from '../schemas/profile';

/**
 * Active-context store — purely reflects the URL prefix.
 *
 * The URL is the source of truth for `/landlord/{slug}` vs `/tenant` vs `/admin`.
 * This store is just a Zustand mirror set by `useActiveContext()` so non-route
 * code (e.g. analytics) can read the current context cheaply.
 *
 * Do NOT navigate by mutating this store; navigate via `router.push()` in the
 * UI layer and let the route effect update the store.
 */
type ActiveContextState = {
  context: ActiveContext | null;
  setContext: (next: ActiveContext | null) => void;
};

export const useActiveContextStore = create<ActiveContextState>((set) => ({
  context: null,
  setContext: (next) => set({ context: next }),
}));
