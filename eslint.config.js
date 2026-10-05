// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'supabase/**', // fonctions Deno — imports npm: et API Deno, pas du code app
      'targets/**', // extensions natives + config Node (__dirname)
      'web/**', // pages statiques hors bundle
      'scripts/**',
      '.maestro/**',
      'store/**',
      'eslint.config.js',
    ],
  },
  {
    rules: {
      // Les shared values Reanimated, les particules et les singletons de module
      // (draft, sounds) sont volontairement mutés hors du render : les règles
      // react-hooks v6 (React Compiler) ne connaissent pas ces patterns RN.
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: ['__tests__/**', 'jest.setup.ts'],
    rules: {
      // jest.mock() doit rester au-dessus des imports (hoisting).
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
