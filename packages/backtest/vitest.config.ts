import { defineConfig } from 'vitest/config';

export default defineConfig({
  extends: '../../vitest.shared.ts',
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
  },
});
