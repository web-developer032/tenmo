import { z } from 'zod';

/**
 * Public env config — readable from anywhere (server, client, native).
 *
 * Server-only secrets must NOT live here. They go in `core/config/server-env.ts`
 * which is only imported from server entry points.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/**
 * Validate and freeze an env-like object. The caller is responsible for
 * providing it (Next.js: `process.env`; RN: from a module).
 */
export function readPublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const parsed = PublicEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid public env vars:\n${issues}`);
  }
  return Object.freeze(parsed.data);
}
