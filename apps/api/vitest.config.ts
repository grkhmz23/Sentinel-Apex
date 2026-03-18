import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    passWithNoTests: true,
    testTimeout: 10_000,
    hookTimeout: 15_000,
    reporters: process.env['CI'] ? ['verbose', 'github-actions'] : ['verbose'],
    include: ['src/**/*.{spec,test}.ts'],
  },
});
