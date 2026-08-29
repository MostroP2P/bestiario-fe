import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'tests/fixtures'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // French typography requires a narrow no-break space (U+202F) before
      // `:` and `;`, and those strings are template literals. The character
      // is required text, not a stray keystroke.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Build scripts are plain Node ESM and sit outside the app's tsconfig.
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { projectService: false, project: false } },
    rules: { 'no-undef': 'off', 'no-console': 'off' },
  },
)
