import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config — Tenantly web.
 *
 * Biome handles formatting + most JS/TS lints (run via `pnpm lint`).
 *
 * ESLint runs three things Biome can't:
 *   1. Next.js–specific rules (`@next/eslint-plugin-next`)
 *   2. React Hooks rules (`eslint-plugin-react-hooks`)
 *   3. The strict `core/` boundary that bans web-only deps from the portable layer.
 */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'src/core/types/supabase.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'next/**'],
              message: 'core/ is portable — no Next.js imports allowed.',
            },
            {
              group: ['react-dom', 'react-dom/*'],
              message: 'core/ is portable — no react-dom imports allowed.',
            },
            {
              group: ['@/app/*', '@/components/*', '@/features/*', '@/lib/*'],
              message: 'core/ must not import from app/components/features/lib.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'core/ is portable — no DOM globals.',
        },
        {
          name: 'document',
          message: 'core/ is portable — no DOM globals.',
        },
        {
          name: 'localStorage',
          message: 'core/ is portable — use a storage adapter.',
        },
        {
          name: 'sessionStorage',
          message: 'core/ is portable — use a storage adapter.',
        },
        {
          name: 'navigator',
          message: 'core/ is portable — no DOM globals.',
        },
        {
          name: 'location',
          message: 'core/ is portable — no DOM globals.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement, JSXFragment',
          message:
            'core/ is hooks + utilities only — no JSX. UI lives in src/components/ or src/features/.',
        },
      ],
    },
  },
];

export default eslintConfig;
