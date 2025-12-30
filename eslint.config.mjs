import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// ESLint flat config for VS Code extension
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/no-require-imports': 'off', // Allow require() for CommonJS compatibility
      curly: 'off',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
    },
  },
  {
    ignores: [
      'out',
      'dist',
      '**/*.d.ts',
      'node_modules',
      'coverage',
      'test-report',
      '*.js',
      'context-example-repositories/**/*',
    ],
  },
  // Allow require() in parser-remark.ts for CommonJS compatibility
  {
    files: ['**/parser-remark.ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  }
);

