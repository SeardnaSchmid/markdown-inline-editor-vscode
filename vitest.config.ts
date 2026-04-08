import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './dist/coverage',
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        'src/test/**',
        'src/extension.ts',
        'src/mermaid/**',
        'src/code-block-hover-provider.ts',
        'src/decorator/decoration-type-registry.ts',
        'src/math/math-decorations.ts',
        'src/forge-context.ts',
        'src/github-context.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(dir, 'src/test/__mocks__/vscode.ts'),
    },
  },
});
