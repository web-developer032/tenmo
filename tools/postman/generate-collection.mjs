#!/usr/bin/env node
// Generates the Postman v2.1 collection + environment from routes.mjs.
// Usage: `node frontend/tools/postman/generate-collection.mjs`
//
// We regenerate when routes change so the JSON is never hand-edited.

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { personas, routes, seededIds } from './routes.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Pre-request script (runs at COLLECTION level) — injects the SSR cookie
// for any request hitting localhost:3000/api/* that isn't a webhook or cron.
//
// The cookie name is derived at runtime from `supabaseUrl` because
// `@supabase/ssr` defaults to `sb-${hostname.split('.')[0]}-auth-token`
// (so http://127.0.0.1:54321 → `sb-127-auth-token`).
// ---------------------------------------------------------------------------
const collectionPreRequestScript = `
const url = pm.request.url.toString();
const isApi = /^https?:\\/\\/[^/]*localhost[^/]*\\/api\\//.test(url);
const isWebhook = /\\/api\\/webhooks\\//.test(url);
const isCron = /\\/api\\/cron\\//.test(url);
if (!isApi || isWebhook || isCron) return;

const sbCookie = pm.collectionVariables.get('sbCookie');
if (!sbCookie) {
  console.warn('No sbCookie — run "_Auth › Sign in" first.');
  return;
}

const supabaseUrl = pm.environment.get('supabaseUrl') || 'http://127.0.0.1:54321';
let host = '127';
try { host = new URL(supabaseUrl).hostname.split('.')[0]; } catch (_) {}
const cookieName = 'sb-' + host + '-auth-token';

pm.request.headers.upsert({ key: 'Cookie', value: cookieName + '=' + sbCookie });
`.trim();

// ---------------------------------------------------------------------------
// Auth helpers (one Sign-in request per persona).
// ---------------------------------------------------------------------------
const signInTestScript = `
const r = pm.response.json();
if (!r.access_token) {
  pm.test('Got an access token', () => pm.expect(r.access_token).to.be.a('string'));
  return;
}
const session = {
  access_token: r.access_token,
  refresh_token: r.refresh_token,
  expires_in: r.expires_in,
  expires_at: r.expires_at,
  token_type: r.token_type,
  provider_token: null,
  provider_refresh_token: null,
  user: r.user,
};
const json = JSON.stringify(session);
// UTF-8 → base64 → base64-URL (the format @supabase/ssr expects: alphabet
// A-Z a-z 0-9 - _, no padding). Standard base64 (+ / =) gets rejected.
const utf8 = unescape(encodeURIComponent(json));
const b64 = (typeof btoa === 'function' ? btoa(utf8) : Buffer.from(json, 'utf8').toString('base64'));
const b64url = b64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
pm.collectionVariables.set('sbCookie', 'base64-' + b64url);
pm.collectionVariables.set('sbAccessToken', r.access_token);
pm.collectionVariables.set('sbUserId', r.user && r.user.id);
console.log('Signed in:', r.user && r.user.email);
`.trim();

function signInRequest(name, email) {
  return {
    name,
    event: [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: signInTestScript.split('\n') },
      },
    ],
    request: {
      method: 'POST',
      header: [
        { key: 'apikey', value: '{{supabaseAnonKey}}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      body: {
        mode: 'raw',
        raw: JSON.stringify({ email, password: 'tenantly-dev' }),
        options: { raw: { language: 'json' } },
      },
      url: {
        raw: '{{supabaseUrl}}/auth/v1/token?grant_type=password',
        host: ['{{supabaseUrl}}'],
        path: ['auth', 'v1', 'token'],
        query: [{ key: 'grant_type', value: 'password' }],
      },
      description: `Sign in as ${email} and store the SSR cookie + access token as collection variables.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Build an API request item.
// ---------------------------------------------------------------------------
function apiItem(route) {
  const headers = [];
  if (route.body !== undefined) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }
  if (route.headers) {
    for (const [k, v] of Object.entries(route.headers)) headers.push({ key: k, value: v });
  }
  if (route.persona === 'cron') {
    headers.push({ key: 'Authorization', value: 'Bearer {{cronSecret}}' });
  }

  // Split path + querystring so Postman renders the URL editor nicely.
  const [path, qs = ''] = route.path.split('?');
  const pathSegments = path.replace(/^\//, '').split('/');
  const query = qs
    ? qs.split('&').map((pair) => {
        const [k, v = ''] = pair.split('=');
        return { key: k, value: v };
      })
    : undefined;

  const url = {
    raw: `{{baseUrl}}${route.path}`,
    host: ['{{baseUrl}}'],
    path: pathSegments,
  };
  if (query) url.query = query;

  const request = {
    method: route.method,
    header: headers,
    url,
    description: route.summary + (route.notes ? `\n\n${route.notes}` : ''),
  };
  if (route.body !== undefined) {
    request.body = {
      mode: 'raw',
      raw: JSON.stringify(route.body, null, 2),
      options: { raw: { language: 'json' } },
    };
  }

  return { name: `${route.method} ${route.path}`, request, response: [] };
}

// ---------------------------------------------------------------------------
// Build folders.
// ---------------------------------------------------------------------------
const authFolder = {
  name: '_Auth',
  description:
    'Run a Sign in request before any API call. It writes `sbCookie` to the collection variables; the collection pre-request script then attaches it to every request that hits a localhost API route.',
  item: Object.entries(personas).map(([key, { email }]) =>
    signInRequest(`Sign in as ${key} (${email})`, email),
  ),
};

const groups = new Map();
for (const route of routes) {
  if (!groups.has(route.group)) groups.set(route.group, []);
  groups.get(route.group).push(apiItem(route));
}

const apiFolders = [...groups.entries()].map(([group, items]) => ({
  name: group,
  item: items,
}));

const collection = {
  info: {
    name: 'Tenantly API',
    description:
      'Auto-generated from frontend/tools/postman/routes.mjs (see frontend/tools/postman/README.md). Re-run `node frontend/tools/postman/generate-collection.mjs` after editing routes.mjs.\n\nQuick start: import this collection + the matching environment file, pick the persona, run `_Auth › Sign in as <persona>`, then hit any request.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'sbCookie', value: '' },
    { key: 'sbAccessToken', value: '' },
    { key: 'sbUserId', value: '' },
  ],
  event: [
    {
      listen: 'prerequest',
      script: { type: 'text/javascript', exec: collectionPreRequestScript.split('\n') },
    },
  ],
  item: [authFolder, ...apiFolders],
};

// ---------------------------------------------------------------------------
// Environment.
// ---------------------------------------------------------------------------
const env = {
  id: '6e5d0a36-tenantly-local',
  name: 'Tenantly — Local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3000', enabled: true },
    { key: 'supabaseUrl', value: 'http://127.0.0.1:54321', enabled: true },
    // Local Supabase anon key. Safe to commit — it's the default for a fresh `supabase start`.
    {
      key: 'supabaseAnonKey',
      value: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      enabled: true,
    },
    { key: 'cronSecret', value: '', enabled: true, type: 'secret' },

    // Persona selector — change the value here, then re-run "Sign in".
    { key: 'personaEmail', value: personas.sara.email, enabled: true },
    { key: 'personaPassword', value: personas.sara.password, enabled: true, type: 'secret' },
  ],
  _postman_variable_scope: 'environment',
};

// Add every seeded ID as an environment var.
for (const [key, value] of Object.entries(seededIds)) {
  env.values.push({ key, value: String(value), enabled: true });
}

const collectionPath = resolve(here, 'Tenantly.postman_collection.json');
const envPath = resolve(here, 'Tenantly.local.postman_environment.json');

await writeFile(collectionPath, JSON.stringify(collection, null, 2) + '\n', 'utf8');
await writeFile(envPath, JSON.stringify(env, null, 2) + '\n', 'utf8');

console.log(`Wrote ${routes.length} routes to:\n  ${collectionPath}\n  ${envPath}`);
