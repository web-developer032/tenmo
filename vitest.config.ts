import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e/**', 'playwright-report/**'],
    // Cold-start on Windows can blow past the default test
    // timeout when the worker pool spins up many forks at
    // once (Phase P added @sentry/nextjs + posthog-* to the
    // dep graph, which made resolution slower). Bump the
    // ceiling so tests don't flake on slower machines.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/core/utils/**', 'src/core/billing/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/types/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Vitest doesn't run inside Next, so the `server-only` guard
      // doesn't apply. Alias to an empty module so test files can
      // exercise modules that include `import 'server-only'` for
      // the production runtime.
      'server-only': resolve(__dirname, './vitest-server-only-shim.ts'),
      // Phase P — Sentry + PostHog SDKs do heavy init at import
      // time and overflow the vitest worker pool timeout. Stub
      // them with the small wrappers in `vitest-*-shim.ts`.
      '@sentry/nextjs': resolve(__dirname, './vitest-sentry-shim.ts'),
      'posthog-js/react': resolve(__dirname, './vitest-posthog-shim.ts'),
      'posthog-js': resolve(__dirname, './vitest-posthog-shim.ts'),
    },
  },
});
