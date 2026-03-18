import { defineWorkspace } from 'vitest/config';

// =============================================================================
// Sentinel Apex — Root Vitest Workspace Configuration
// =============================================================================
// This file wires together all package-level test suites so that running
// `vitest` (or `pnpm test`) at the repo root discovers every test.
//
// Each workspace entry can either point to a directory containing its own
// vitest.config.ts, or inline the config here. We use inline configs so that
// coverage is aggregated across the entire monorepo in a single report.
// =============================================================================

export default defineWorkspace([
  // ── Packages ───────────────────────────────────────────────────────────────
  {
    extends: './vitest.shared.ts',
    test: {
      name: 'config',
      root: './packages/config',
      include: ['src/**/*.{spec,test}.ts'],
      environment: 'node',
    },
  },
  {
    extends: './vitest.shared.ts',
    test: {
      name: 'domain',
      root: './packages/domain',
      include: ['src/**/*.{spec,test}.ts'],
      environment: 'node',
    },
  },
  {
    extends: './vitest.shared.ts',
    test: {
      name: 'observability',
      root: './packages/observability',
      include: ['src/**/*.{spec,test}.ts'],
      environment: 'node',
    },
  },
  {
    extends: './vitest.shared.ts',
    test: {
      name: 'shared',
      root: './packages/shared',
      include: ['src/**/*.{spec,test}.ts'],
      environment: 'node',
    },
  },

  // ── Apps ───────────────────────────────────────────────────────────────────
  {
    extends: './vitest.shared.ts',
    test: {
      name: 'api',
      root: './apps/api',
      include: ['src/**/*.{spec,test}.ts'],
      environment: 'node',
    },
  },
]);
