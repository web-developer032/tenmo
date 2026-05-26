#!/usr/bin/env node
// frontend/scripts/api-smoke.mjs
//
// HTTP smoke tester for every Tenantly API route declared in
// frontend/tools/postman/routes.mjs. Persona-driven: signs each seeded
// user in via Supabase REST, base64-encodes the session into an
// `sb-tenantly-auth-token` cookie, then hits `localhost:3000/api/*`
// with the right cookie per route.
//
// Usage:
//   node frontend/scripts/api-smoke.mjs                     # full run
//   node frontend/scripts/api-smoke.mjs --group=tickets     # one folder
//   node frontend/scripts/api-smoke.mjs --persona=jordan    # one persona
//   node frontend/scripts/api-smoke.mjs --include-webhooks  # opt in
//   node frontend/scripts/api-smoke.mjs --no-mutating       # GETs only
//   node frontend/scripts/api-smoke.mjs --verbose           # show bodies
//   node frontend/scripts/api-smoke.mjs --out path.md       # custom report
//
// Exit code is the number of unexpected failures (0 = clean).
//
// Prereqs:
//   1. `cd backend && supabase db reset`  → applies migrations + seed.
//   2. `cd frontend && npm run dev`       → starts Next on :3000.
//   3. `frontend/.env.local` has NEXT_PUBLIC_SUPABASE_URL +
//      NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { personas, routes, seededIds } from '../tools/postman/routes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      return eq === -1 ? [[a.slice(2), true]] : [[a.slice(2, eq), a.slice(eq + 1)]];
    }
    return [];
  }),
);

const FILTER_GROUP = args.group ?? null;
const FILTER_PERSONA = args.persona ?? null;
const INCLUDE_WEBHOOKS = Boolean(args['include-webhooks']);
const NO_MUTATING = Boolean(args['no-mutating']);
const VERBOSE = Boolean(args.verbose);
const OUT_PATH = args.out
  ? resolve(process.cwd(), args.out)
  : resolve(repoRoot, 'docs/12-stakeholder-docs/qa/smoke-results-2026-05-23.md');

// ---------------------------------------------------------------------------
// .env.local loader (no dotenv dep — Node 22 has --env-file but we don't
// require callers to pass it).
// ---------------------------------------------------------------------------
async function loadEnv() {
  const envPath = resolve(repoRoot, 'frontend/.env.local');
  try {
    const raw = await readFile(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    console.warn(`Could not read ${envPath}: ${err.message}`);
  }
}

await loadEnv();

const BASE_URL = process.env.TENANTLY_BASE_URL ?? 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET ?? '';

if (!SUPABASE_ANON) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in env. Aborting.');
  process.exit(2);
}

// `@supabase/ssr` derives the cookie name from the Supabase URL hostname.
// Default: `sb-${hostname.split('.')[0]}-auth-token`. For local
// http://127.0.0.1:54321 that's `sb-127-auth-token`; for prod it'll be
// `sb-<project-ref>-auth-token`.
const COOKIE_NAME = (() => {
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return `sb-${host.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-localhost-auth-token';
  }
})();

// ---------------------------------------------------------------------------
// ANSI helpers (no dep on chalk; node 22 supports ANSI in modern terminals)
// ---------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = useColor
  ? {
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      gray: (s) => `\x1b[90m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
    }
  : {
      green: (s) => s,
      red: (s) => s,
      yellow: (s) => s,
      gray: (s) => s,
      bold: (s) => s,
      dim: (s) => s,
    };

// ---------------------------------------------------------------------------
// Sign in a persona → return the SSR cookie value.
// ---------------------------------------------------------------------------
async function signIn(personaKey) {
  const { email, password } = personas[personaKey];
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) {
    throw new Error(`Sign-in failed for ${personaKey}: ${JSON.stringify(j)}`);
  }
  const session = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_in: j.expires_in,
    expires_at: j.expires_at,
    token_type: j.token_type,
    provider_token: null,
    provider_refresh_token: null,
    user: j.user,
  };
  // `@supabase/ssr` uses URL-safe base64 with no padding (see
  // node_modules/@supabase/ssr/dist/main/utils/base64url.js). Standard
  // base64 (`+`/`/`/`=`) is rejected with "Invalid Base64-URL character".
  const b64 = Buffer.from(JSON.stringify(session), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { cookie: 'base64-' + b64, userId: j.user.id, email };
}

const sessions = {};
const signInResults = [];
for (const personaKey of Object.keys(personas)) {
  try {
    sessions[personaKey] = await signIn(personaKey);
    signInResults.push({ persona: personaKey, status: 'ok' });
  } catch (err) {
    signInResults.push({ persona: personaKey, status: 'fail', error: err.message });
  }
}

console.log(c.bold('\n=== Sign-in ==='));
for (const r of signInResults) {
  const tag = r.status === 'ok' ? c.green('OK ') : c.red('FAIL');
  console.log(`  ${tag} ${r.persona.padEnd(8)} ${r.status === 'fail' ? c.red(r.error) : ''}`);
}

if (signInResults.some((r) => r.status === 'fail')) {
  console.error('\nOne or more personas could not sign in. Did `supabase db reset` run?');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Resolve runtime IDs (conversation, notification) by querying via service
// role. Only used to fill placeholders that aren't in seededIds.
// ---------------------------------------------------------------------------
async function resolveRuntimeIds() {
  if (!SUPABASE_SERVICE) {
    return {
      jordanConversationId: '00000000-0000-0000-0000-000000000000',
      jordanNotificationId: '00000000-0000-0000-0000-000000000000',
    };
  }
  async function sb(path, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE,
        Authorization: `Bearer ${SUPABASE_SERVICE}`,
        Accept: 'application/json',
      },
    });
    return r.json();
  }
  const convRows = await sb(
    'conversations',
    `tenancy_id=eq.${seededIds.jordanTenancyId}&select=id&limit=1`,
  );
  const notifRows = await sb(
    'notifications',
    `user_id=eq.${seededIds.jordanId}&kind=eq.message_received&select=id&limit=1`,
  );
  return {
    jordanConversationId: convRows?.[0]?.id ?? '00000000-0000-0000-0000-000000000000',
    jordanNotificationId: notifRows?.[0]?.id ?? '00000000-0000-0000-0000-000000000000',
  };
}

const runtimeIds = await resolveRuntimeIds();
const vars = { ...seededIds, ...runtimeIds };

console.log(c.bold('\n=== Runtime IDs ==='));
console.log(`  jordanConversationId: ${runtimeIds.jordanConversationId}`);
console.log(`  jordanNotificationId: ${runtimeIds.jordanNotificationId}`);

// ---------------------------------------------------------------------------
// Substitute {{var}} placeholders in URLs + bodies.
// ---------------------------------------------------------------------------
function substitute(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

function substituteDeep(value) {
  if (value == null) return value;
  if (typeof value === 'string') return substitute(value);
  if (Array.isArray(value)) return value.map(substituteDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteDeep(v);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Filter the route list.
// ---------------------------------------------------------------------------
const filtered = routes.filter((r) => {
  if (r.skipInSmoke) return false;
  if (FILTER_GROUP && r.group !== FILTER_GROUP) return false;
  if (FILTER_PERSONA && r.persona !== FILTER_PERSONA) return false;
  if (r.group === 'webhooks' && !INCLUDE_WEBHOOKS) return false;
  if (NO_MUTATING && r.method !== 'GET') return false;
  return true;
});

console.log(c.bold(`\n=== Running ${filtered.length} route(s) ===\n`));

// ---------------------------------------------------------------------------
// Per-route execution.
// ---------------------------------------------------------------------------
const results = [];

for (const route of filtered) {
  const path = substitute(route.path);
  const url = `${BASE_URL}${path}`;
  const headers = { Accept: 'application/json' };

  if (route.body !== undefined) headers['Content-Type'] = 'application/json';
  if (route.headers) Object.assign(headers, route.headers);

  if (route.persona === 'cron') {
    if (CRON_SECRET) headers.Authorization = `Bearer ${CRON_SECRET}`;
  } else if (route.persona === 'public' || route.persona === 'webhook') {
    // No cookie.
  } else {
    const sess = sessions[route.persona];
    if (sess) headers.Cookie = `${COOKIE_NAME}=${sess.cookie}`;
  }

  const body = route.body !== undefined ? JSON.stringify(substituteDeep(route.body)) : undefined;

  const started = Date.now();
  let status = 0;
  let bodySample = '';
  let err = null;
  try {
    const res = await fetch(url, { method: route.method, headers, body });
    status = res.status;
    const text = await res.text();
    bodySample = text.length > 240 ? text.slice(0, 240) + '…' : text;
  } catch (e) {
    err = e.message;
  }
  const ms = Date.now() - started;

  const passed = err === null && route.expect.includes(status);
  results.push({
    group: route.group,
    persona: route.persona,
    method: route.method,
    path,
    expected: route.expect.join('/'),
    actual: err ? 'ERR' : String(status),
    ms,
    passed,
    body: bodySample,
    error: err,
    notes: route.notes ?? null,
  });

  const tag = passed ? c.green('PASS') : c.red('FAIL');
  const personaTag = c.gray(`[${route.persona}]`.padEnd(10));
  const line = `${tag} ${personaTag} ${route.method.padEnd(6)} ${path}  ${c.dim(
    `→ ${err ? 'ERR' : status} (${ms}ms)`,
  )}`;
  console.log(line);
  if (!passed && VERBOSE) {
    console.log(c.gray('       body: ' + bodySample.replace(/\s+/g, ' ').slice(0, 200)));
    if (err) console.log(c.red('       error: ' + err));
  } else if (VERBOSE) {
    console.log(c.gray('       body: ' + bodySample.replace(/\s+/g, ' ').slice(0, 120)));
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const passed = results.filter((r) => r.passed).length;
const failed = results.length - passed;

console.log('');
console.log(c.bold('=== Summary ==='));
console.log(`  Total : ${results.length}`);
console.log(`  ${c.green('Pass')}  : ${passed}`);
console.log(`  ${failed === 0 ? c.green('Fail') : c.red('Fail')}  : ${failed}`);

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------
const now = new Date().toISOString();
const md = [];
md.push('# API smoke results');
md.push('');
md.push(`Run at: ${now}`);
md.push(`Base URL: ${BASE_URL}`);
md.push(
  `Filters: group=${FILTER_GROUP ?? 'all'}  persona=${FILTER_PERSONA ?? 'all'}  ` +
    `webhooks=${INCLUDE_WEBHOOKS ? 'yes' : 'no'}  no-mutating=${NO_MUTATING ? 'yes' : 'no'}`,
);
md.push('');
md.push(`**${passed} pass · ${failed} fail · ${results.length} total**`);
md.push('');
md.push('Generated by `node frontend/scripts/api-smoke.mjs`. See');
md.push('`docs/05-backend/api-smoke-testing.md` for how to read this file.');
md.push('');

const byGroup = new Map();
for (const r of results) {
  if (!byGroup.has(r.group)) byGroup.set(r.group, []);
  byGroup.get(r.group).push(r);
}

for (const [group, items] of byGroup) {
  md.push(`## ${group}`);
  md.push('');
  md.push('| ✓ | Method | Path | Persona | Expected | Actual | Latency | Notes |');
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of items) {
    md.push(
      `| ${r.passed ? '✅' : '❌'} | ${r.method} | \`${r.path}\` | ${r.persona} | ${r.expected} | ${
        r.actual
      } | ${r.ms} ms | ${r.notes ?? ''} |`,
    );
  }
  md.push('');
  const failsHere = items.filter((r) => !r.passed);
  if (failsHere.length > 0) {
    md.push('### Failures in detail');
    md.push('');
    for (const r of failsHere) {
      md.push(`- **${r.method} ${r.path}** (persona: ${r.persona})`);
      md.push(`  - Expected: ${r.expected}`);
      md.push(`  - Got: ${r.actual}${r.error ? ` (error: ${r.error})` : ''}`);
      const sample = r.body.replace(/\s+/g, ' ').slice(0, 240);
      if (sample) md.push(`  - Body sample: \`${sample.replace(/`/g, '\\`')}\``);
      md.push('');
    }
  }
}

await writeFile(OUT_PATH, md.join('\n'), 'utf8');
console.log(`\nResults written to ${OUT_PATH}`);

process.exit(failed);
