import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// ESLint flat config for VS Code extension
export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/no-require-imports': 'off', // Allow require() for CommonJS compatibility
      curly: 'off',
      eqeqeq: 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    ignores: [
      'out',
      'dist',
      '.vscode-test/**',
      '.vscode-test.mjs',
      '.vscode-test-cursor.mjs',
      'build',
      'assets/**',
      '**/*.d.ts',
      'node_modules',
      'coverage',
      'test-report',
      '*.js',
      '**/*.min.js',
      'examples/**',
    ],
  },
  // Allow require() and any types in parser-remark.ts for CommonJS compatibility
  {
    files: ['**/parser-remark.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // Necessary for dynamic require/import pattern
    },
  },
  // Ignore strict lint rules for test files - no warnings, just ignore
  {
    files: ['**/__mocks__/**', '**/__tests__/**', '**/*.test.ts', '**/*.test.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  // Node.js scripts directory - allow CommonJS and Node.js globals
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
      ecmaVersion: 'latest',
      sourceType: 'script',
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  }
);
