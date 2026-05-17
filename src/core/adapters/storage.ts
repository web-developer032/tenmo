/**
 * Storage adapter — abstracts persistent key-value storage across platforms.
 *
 * - Web: backed by `localStorage` (provided by `@/lib/bootstrap.ts`).
 * - RN: backed by `AsyncStorage` (provided by mobile bootstrapper).
 * - Server: a no-op or in-memory map.
 *
 * `core/` code only sees the interface; the impl is injected at startup.
 */
export type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storage: StorageAdapter | null = null;

export function setStorage(impl: StorageAdapter): void {
  storage = impl;
}

export function getStorage(): StorageAdapter {
  if (!storage) {
    throw new Error(
      'Storage adapter not initialised. Call setStorage() in your platform bootstrapper.',
    );
  }
  return storage;
}

/** No-op implementation — useful for tests and SSR. */
export const noopStorage: StorageAdapter = {
  getItem: async () => null,
  setItem: async () => {
    /* noop */
  },
  removeItem: async () => {
    /* noop */
  },
};
