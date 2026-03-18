import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
    passWithNoTests: true,
    testTimeout: 10_000,
    hookTimeout: 15_000,
    reporters: process.env['CI'] ? ['verbose', 'github-actions'] : ['verbose'],
    coverage: {
      provider: 'v8',
      enabled: !!process.env['COVERAGE'],
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
