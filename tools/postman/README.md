# Postman collection — Tenantly API

Generated collection covering every route under `frontend/src/app/api/**`,
shipped as a static JSON so you can drop it into Postman / Bruno / Insomnia
and immediately exercise the API against a local Supabase stack.

## What's in the folder

| File | Purpose |
| --- | --- |
| `routes.mjs` | Source of truth — route list + persona assignment + example bodies + seeded IDs. **Edit this**, not the JSON. |
| `generate-collection.mjs` | Reads `routes.mjs` → writes the collection + environment. Re-run after edits. |
| `Tenantly.postman_collection.json` | Postman v2.1 collection — committed so reviewers don't have to run Node. |
| `Tenantly.local.postman_environment.json` | Matching environment with seeded IDs and persona vars. |
| `README.md` | This file. |

`routes.mjs` is also imported by `frontend/scripts/api-smoke.ts`, so the
Postman collection and the automated smoke runner share one registry.

## Prerequisites (local)

1. Local Supabase stack up: `cd backend && supabase start && supabase db reset`.
   The reset applies seed data including `riley@example.com` (applicant),
   a published listing on Sara's Room 3, conversation messages, a `sent`
   AST envelope, etc.
2. Next.js dev server up: `cd frontend && npm run dev` (binds `localhost:3000`).
3. Postman ≥ 10 (cookies + `pm.collectionVariables` API).

## Quick start

1. **Import** both JSON files into Postman.
2. **Select** the *Tenantly — Local* environment from the env dropdown.
3. **Pick a persona** (default is `sara`) by editing `personaEmail` /
   `personaPassword` in the environment. The seeded options:

   | Persona | Email | Why pick them |
   | --- | --- | --- |
   | `sara`   | `sara@example.com`   | Solo HMO landlord. Best default for landlord routes. |
   | `marcus` | `marcus@example.com` | Portfolio landlord. Use for AST envelope routes. |
   | `priya`  | `priya@example.com`  | Live-in landlord (free tier). Tier-gating tests. |
   | `jordan` | `jordan@example.com` | Tenant in Sara's HMO. Best default for tenant routes. |
   | `alex`   | `alex@example.com`   | Dual-role (landlord + tenant). |
   | `nina`   | `nina@example.com`   | Brand-new landlord with no orgs — use for `POST /api/orgs`. |
   | `admin`  | `admin@example.com`  | Platform admin. Required for `/api/admin/*`. |
   | `riley`  | `riley@example.com`  | Applicant with a pending application on Sara's Room 3. |

   All passwords are `tenantly-dev`.
4. **Run** *_Auth → Sign in as `<persona>`*. The test script stores
   `sbCookie` (base64-encoded session JSON) on the collection.
5. Hit any request. The collection-level pre-request script auto-attaches
   `Cookie: sb-tenantly-auth-token={{sbCookie}}` to every API request.

To switch persona mid-session: change `personaEmail` + `personaPassword` and
re-run a Sign in request.

## How auth actually works

Tenantly's API routes accept **cookie auth only** (no `Authorization: Bearer
<jwt>`). Cookies are written by `@supabase/ssr`, which is normally invoked
from the browser. Postman emulates that by:

1. Hitting `POST {{supabaseUrl}}/auth/v1/token?grant_type=password` directly
   on Supabase REST.
2. Re-shaping the response into the JSON session blob that `@supabase/ssr`
   expects (`access_token`, `refresh_token`, `expires_at`, `user`, …).
3. Encoding it with URL-safe base64 (alphabet `A-Z a-z 0-9 - _`, no padding)
   and prefixing with `base64-`. Standard base64 (`+ / =`) gets rejected by
   `@supabase/ssr`'s decoder.
4. Saving as collection variable `sbCookie`.
5. Each API request gets a `Cookie: sb-<projectRef>-auth-token={{sbCookie}}`
   header injected by the collection's pre-request script. The project ref
   is derived from `supabaseUrl` (`http://127.0.0.1:54321` →
   `sb-127-auth-token`; `https://abcd.supabase.co` → `sb-abcd-auth-token`).

Exceptions:

- `/api/webhooks/*` — uses provider HMAC headers (`stripe-signature`,
  `webhook-signature`, `x-docuseal-signature`). Postman can't sign these for
  you; use `stripe trigger`, the GoCardless sandbox dashboard, or the
  DocuSeal test event button.
- `/api/cron/*` — uses `Authorization: Bearer {{cronSecret}}`. Set
  `cronSecret` in the environment, OR (if it's empty) the routes accept
  localhost-only requests for dev.

## Regenerating after a route change

```bash
# from the repo root
node frontend/tools/postman/generate-collection.mjs
```

The script reads `routes.mjs` and overwrites the two JSON files. Re-import
them in Postman (or use the Postman File → Import → "Sync with file"
feature).

## Keeping `routes.mjs` and the smoke script in sync

`frontend/scripts/api-smoke.ts` imports the same `routes.mjs`. When you add
a new API endpoint:

1. Add a row to `routes.mjs` with `group`, `persona`, `method`, `path`,
   `summary`, `body` (if applicable), and `expect` (status code array).
2. If the route writes data you don't want exercised on every smoke run,
   set `skipInSmoke: true`. Postman users will still see it.
3. Re-run the generator.
4. Run `pnpm api:smoke` to verify the route behaves as expected.
