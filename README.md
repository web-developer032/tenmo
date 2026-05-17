# Tenantly — Web (`frontend/`)

Next.js 16 (App Router) + React 19 + TypeScript 6 strict + Tailwind v4 + shadcn/ui.

## Folder layout

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # /login, /signup, /magic-link  (no app shell)
│   ├── auth/callback/route.ts    # Supabase OAuth/magic-link callback
│   ├── api/                      # Route Handlers (REST API)
│   ├── dispatch/                 # Single post-login fan-out
│   ├── onboarding/               # Pick role → create org / wait for invite
│   ├── landlord/[slug]/          # Landlord workspace (org-scoped)
│   ├── tenant/                   # Tenant dashboard (one user, many tenancies)
│   ├── admin/                    # Platform admin (admin_users only)
│   └── page.tsx                  # Public homepage
├── components/
│   ├── ui/                       # shadcn primitives (web-only)
│   ├── app-shell/                # Header, sidebar, user menu
│   └── common/                   # EmptyState, etc.
├── features/                     # Feature folders — one per product surface
│   ├── auth/
│   ├── onboarding/
│   ├── role-switcher/
│   ├── properties/
│   ├── rooms/
│   └── landlord-dashboard/
├── core/                         # PORTABLE — copy/paste to mobile (Expo).
│   ├── schemas/                  # Zod schemas
│   ├── api/                      # fetch wrapper + error types
│   ├── queries/                  # TanStack Query hooks
│   ├── stores/                   # Zustand stores (no React/DOM deps)
│   ├── utils/                    # Money, dates, slug, tenancy rules
│   ├── billing/                  # Subscription tier matrix
│   ├── constants/                # UK compliance rules as data
│   ├── adapters/                 # Storage, etc. (interfaces only)
│   └── README.md                 # Portable-core contract
├── lib/                          # WEB-ONLY infra
│   ├── supabase/                 # Browser/server/middleware clients
│   ├── handler.ts                # Route Handler wrapper + error envelope
│   ├── errors.ts                 # AppError + codes
│   ├── logger.ts                 # Pino with PII redaction
│   ├── rate-limit.ts             # Upstash sliding-window
│   ├── env.public.ts             # Validated NEXT_PUBLIC_*
│   └── env.server.ts             # Validated server secrets
└── middleware.ts                 # Supabase cookie refresh
```

## The portable `core/` rule

Anything inside `src/core/` MUST stay platform-agnostic. ESLint enforces:

- No `react`, `react-dom`, `next/*`, browser globals (`window`, `document`).
- No JSX. Hooks live in `core/queries/` and call platform-agnostic APIs.
- Tailwind classes never appear in `core/` files.

When the mobile app starts (Expo), we copy `src/core/` and swap web-only
adapters in `src/lib/` for React Native equivalents. **Edit `core/` carefully —
breaking the contract breaks the mobile plan.**

See [`src/core/README.md`](./src/core/README.md) for the full contract.

## Auth

We use Supabase Auth via [`@supabase/ssr`](https://github.com/supabase/ssr):

- Browser client: `src/lib/supabase/client.ts`
- Server client (Server Components / Server Actions / Route Handlers):
  `src/lib/supabase/server.ts`
- Cookie refresh middleware: `src/lib/supabase/middleware.ts` + `src/middleware.ts`

Login lives at `/login` (email + password) and `/magic-link` (one-time link).
The `/auth/callback` Route Handler exchanges OAuth/PKCE codes for sessions.
After login, every entry point routes through `/dispatch`, which decides
whether to send the user to `/landlord/[slug]`, `/tenant`, or `/onboarding`.

## Roles are derived

There is no `role` column on users. A user is a **landlord** if they have an
`org_memberships` row, a **tenant** if they have a `tenancies.tenant_user_id`
row, and an **admin** if they appear in `admin_users`. The `RoleSwitcher` reads
this directly from the database (`features/role-switcher/loader.ts`) and the
URL is the source of truth for the active context.

## Route Handlers

All API endpoints live under `src/app/api/...` and use the `handler()` wrapper
in `src/lib/handler.ts`. It provides:

- A typed Supabase client (`ctx.supabase`) running with the user's RLS scope
- The current `ctx.user` (or 401 if `requireAuth: true`)
- `ctx.requestId`, `ctx.log`
- A consistent error envelope: `{ error: { code, message, details, requestId } }`

```ts
export const POST = handler<{ orgId: string }>(async (ctx, params) => {
  await assertOrgMember(ctx, params.orgId, ['owner', 'agent']);
  const input = MyZodSchema.parse(await ctx.req.json());
  // ... do work, return Response.json({ data })
}, { requireAuth: true });
```

## Scripts

```bash
pnpm dev          # next dev --turbopack
pnpm build        # next build
pnpm lint         # biome check
pnpm lint:next    # next lint (ESLint, with core/ boundary rule)
pnpm type-check   # tsc --noEmit
pnpm test         # vitest run
pnpm test:e2e     # playwright test
pnpm db:types     # regenerate Supabase types
```

## Environment

Copy `.env.example` to `.env.local` and fill in. Supabase local-dev keys are
printed by `supabase start`. Don't put secrets in any `NEXT_PUBLIC_*` var.

## Conventions worth memorising

- **Money is integer pence.** No floats. Helpers in `core/utils/money.ts`.
- **Dates are ISO `YYYY-MM-DD`.** Helpers in `core/utils/dates.ts`.
- **Tenants are free, forever.** No code path may charge a tenant; the
  capability matrix in `core/billing/capabilities.ts` is the gatekeeper.
- **No Section 21.** `rejectSection21()` in `core/utils/tenancy-rules.ts` is
  wired into any path that might tempt you.
