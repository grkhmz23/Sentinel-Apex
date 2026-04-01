import { defineWorkspace } from 'vitest/config';

function nodeProject(
  name: string,
  root: string,
  include = ['src/**/*.{spec,test}.ts'],
  overrides?: Partial<{
    testTimeout: number;
    hookTimeout: number;
  }>,
): {
  extends: string;
  test: {
    name: string;
    root: string;
    include: string[];
    environment: 'node';
    testTimeout?: number;
    hookTimeout?: number;
  };
} {
  return {
    extends: './vitest.shared.ts',
    test: {
      name,
      root,
      include,
      environment: 'node',
      ...overrides,
    },
  };
}

export default defineWorkspace([
  nodeProject('allocator', './packages/allocator'),
  nodeProject('carry', './packages/carry'),
  nodeProject('config', './packages/config'),
  nodeProject('db', './packages/db'),
  nodeProject('domain', './packages/domain'),
  nodeProject('execution', './packages/execution'),
  nodeProject('observability', './packages/observability'),
  nodeProject('risk-engine', './packages/risk-engine'),
  nodeProject('runtime', './packages/runtime', ['src/**/*.{spec,test}.ts'], {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  }),
  nodeProject('shared', './packages/shared'),
  nodeProject('strategy-engine', './packages/strategy-engine'),
  nodeProject('treasury', './packages/treasury'),
  nodeProject('venue-adapters', './packages/venue-adapters'),
  nodeProject('api', './apps/api', ['src/**/*.{spec,test}.ts'], {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  }),
  './apps/ops-dashboard/vitest.config.ts',
  nodeProject('runtime-worker', './apps/runtime-worker'),
]);
