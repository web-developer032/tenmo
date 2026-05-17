# `core/` — portable package

This folder is **portable**. Every file here must run unchanged in:

- Node.js 22 (CI, scripts).
- Next.js 16 Server Components.
- Next.js 16 Client Components.
- React Native (Expo) — Phase 2.

## Hard rules (enforced by ESLint)

- ❌ No `next/*` imports.
- ❌ No `react-dom`.
- ❌ No DOM globals (`window`, `document`, `localStorage`, `navigator`, `location`).
- ❌ No JSX. `.ts` files only.
- ❌ No Tailwind class strings.
- ❌ No imports from `@/app`, `@/components`, `@/features`, `@/lib`.
- ❌ No raw `fetch(` — use `core/api/http.ts`.
- ✅ Allowed deps: `react`, `@tanstack/react-query`, `zustand`, `zod`, `@supabase/supabase-js`, `date-fns`, `nanoid`, `lodash-es`, plus internal `core/*`.

If a feature needs platform code (storage, navigation, file I/O), define an
**adapter interface** in `core/adapters/` and let the bootstrapper inject the impl.

## Folder layout

| Folder | Purpose |
|---|---|
| `api/` | Fetch wrappers + endpoint functions |
| `schemas/` | Zod schemas, one file per entity |
| `types/` | Derived types (`z.infer<>`) and Supabase-generated |
| `queries/` | TanStack Query hooks |
| `stores/` | Zustand stores |
| `utils/` | Pure functions |
| `constants/` | Enums, compliance rules, tier capabilities |
| `billing/` | Tier capability matrix + fee absorption |
| `adapters/` | Platform-specific contracts (storage, network) |
| `config/` | Zod-validated env config |

## Adding a new dependency

1. Verify it's pure JS (works in Node + RN).
2. Add it to the allow-list in `docs/11-mobile-readiness/portable-modules.md`.
3. Pin exact version in `package.json`.
4. Run `pnpm test` — Vitest runs `core/` in jsdom-free Node environment.

## Public surface

Re-export from `core/index.ts` only what's intentional. Internals stay internal.

See `docs/11-mobile-readiness/portable-modules.md` for the full spec.
