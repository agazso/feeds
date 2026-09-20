import svelteParser from 'svelte-eslint-parser'
import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginSvelte from 'eslint-plugin-svelte'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  ...eslintPluginSvelte.configs['flat/recommended'],
  eslintConfigPrettier,
  ...eslintPluginSvelte.configs['flat/prettier'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: typescriptEslint.parser, extraFileExtensions: ['.svelte'] },
    },
  },
  {
    rules: {
      // Carried over from the biome config these rules replace.
      // `destructuring: 'all'` so a Svelte 5 `$props()` destructuring that mixes a
      // $bindable (which must stay `let`) with plain props is not reported.
      'prefer-const': ['error', { destructuring: 'all' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // TypeScript already resolves globals and DOM types; no-undef only produces
      // false positives on them (typescript-eslint's own recommendation).
      'no-undef': 'off',
      // This app carries the user scope with prefix() ($lib/prefix), not resolve() —
      // see the "every in-app link must go through prefix()" invariant in
      // docs/ARCHITECTURE.md §5. Enforcing resolve() would contradict it.
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    // Mirrors .gitignore + .prettierignore: build output, generated data and secrets.
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/.svelte-kit/',
      '**/deploy-out/',
      'packages/app/static/',
      'packages/app/cache/',
      'packages/app/models/',
      'packages/app/users.json',
    ],
  },
)
