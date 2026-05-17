#!/usr/bin/env node
/**
 * Cross-platform wrapper around `supabase gen types typescript --local`.
 *
 * The Supabase CLI prints status lines (e.g. "Connecting to db 54322") to
 * stderr by default but on some Windows shells they end up mixed into
 * stdout when the script uses naive `>` redirection. This script runs the
 * CLI from the `backend/` directory, captures only stdout, validates the
 * result, and writes it to `src/core/types/supabase.ts` from the project
 * root regardless of the host shell.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, '..');
const BACKEND_ROOT = resolve(FRONTEND_ROOT, '..', 'backend');
const OUTPUT = resolve(FRONTEND_ROOT, 'src', 'core', 'types', 'supabase.ts');

const result = spawnSync('npx', ['supabase', 'gen', 'types', 'typescript', '--local'], {
  cwd: BACKEND_ROOT,
  encoding: 'utf8',
  shell: true,
  stdio: ['ignore', 'pipe', 'inherit'],
});

if (result.error) {
  console.error('Failed to spawn supabase CLI:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`supabase CLI exited with status ${result.status}`);
  process.exit(result.status ?? 1);
}

const output = result.stdout?.trim() ?? '';

if (!output.startsWith('export type') && !output.startsWith('export ')) {
  console.error('Unexpected supabase CLI output (first 200 chars):');
  console.error(output.slice(0, 200));
  process.exit(1);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${output}\n`, 'utf8');
process.stdout.write(`Wrote ${OUTPUT}\n`);
