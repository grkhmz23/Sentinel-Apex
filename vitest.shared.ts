import { defineConfig } from 'vitest/config';

// =============================================================================
// Sentinel Apex — Shared Vitest Configuration
// =============================================================================
// Extended by the root workspace config (vitest.config.ts) for every package.
// Individual packages may further extend this if they need custom transforms,
// aliases, or environment variables.
// =============================================================================

export default defineConfig({
  test: {
    // ── Runner ──────────────────────────────────────────────────────────────
    globals: false,
    environment: 'node',
    passWithNoTests: true,

    // ── Timeouts ────────────────────────────────────────────────────────────
    testTimeout: 10_000,
    hookTimeout: 15_000,

    // ── Reporters ───────────────────────────────────────────────────────────
    reporters: process.env['CI'] ? ['verbose', 'github-actions'] : ['verbose'],

    // ── Coverage ────────────────────────────────────────────────────────────
    coverage: {
      provider: 'v8',
      enabled: !!process.env['COVERAGE'],
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',     // barrel files — typically trivial re-exports
        'src/generated/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // ── Setup files ──────────────────────────────────────────────────────────
    // Place per-package setup at <package>/src/test/setup.ts and override in
    // the workspace entry if needed.
    // setupFiles: ['./src/test/setup.ts'],
  },
});
