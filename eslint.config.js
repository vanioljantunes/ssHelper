import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/core must not depend on React.' },
            { name: 'react-dom', message: 'src/core must not depend on React.' },
          ],
          patterns: [
            { group: ['**/ui', '**/ui/**'], message: 'src/core must not import UI.' },
            {
              group: ['**/pubmed', '**/pubmed/**'],
              message: 'src/core must not import the PubMed client.',
            },
            {
              group: ['**/storage', '**/storage/**'],
              message: 'src/core must not import storage.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'src/core must not call the network.' },
        { name: 'localStorage', message: 'src/core must not use storage.' },
        { name: 'window', message: 'src/core must not use browser globals.' },
        { name: 'document', message: 'src/core must not use browser globals.' },
      ],
    },
  },
);
