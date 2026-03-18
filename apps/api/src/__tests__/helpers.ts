import { randomUUID } from 'node:crypto';

import { SentinelRuntime } from '@sentinel-apex/runtime';

type RuntimeOverrides = NonNullable<Parameters<typeof SentinelRuntime.createDeterministic>[1]>;

export async function createTestRuntime(
  overrides: RuntimeOverrides = {},
): Promise<SentinelRuntime> {
  const connectionString = `file:///tmp/sentinel-apex-api-test-${randomUUID()}`;
  return SentinelRuntime.createDeterministic(connectionString, overrides);
}
