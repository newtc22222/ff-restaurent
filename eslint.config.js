import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
      },
      globals: {
        // Injected by the define block in apps/web/vite.config.ts.
        __APP_VERSION__: 'readonly',
        Buffer: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/no-mutable-exports': 'error',
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'JSXElement[openingElement.name.name="select"]',
          message:
            'Do not use native <select>. Use the shared Dropdown component (@/components/ui/Dropdown.tsx) instead.',
        },
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/text-\\[\\d+px\\]/]',
          message:
            'Do not use arbitrary font sizes text-[Npx]. Use standard font scale tokens (text-2xs, text-xs, text-compact, text-sm, text-base, text-lg, text-xl).',
        },
        {
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/bg-\\[#[0-9a-fA-F]+\\]|text-\\[#[0-9a-fA-F]+\\]/]',
          message:
            'Do not use hardcoded hex colors in className. Use semantic theme tokens (bg-saffron, bg-basil, chip-saffron, etc.).',
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/*.test.ts', 'src/*.test.ts'],
    languageOptions: {
      parserOptions: { projectService: false },
    },
  },
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'apps/api/prisma/migrations/**',
    ],
  },
];
