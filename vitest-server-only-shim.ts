// Vitest shim for `server-only`. Real Next.js wires this to a build
// error so client bundles can't pull in server modules; tests don't
// need that guard, and a no-op export lets any module import it.
export {};
