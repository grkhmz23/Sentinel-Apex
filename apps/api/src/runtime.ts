import { config } from '@sentinel-apex/config';
import { SentinelRuntime } from '@sentinel-apex/runtime';

export async function createRuntimeFromEnv(): Promise<SentinelRuntime> {
  return SentinelRuntime.createDeterministic(config.DATABASE_URL, {
    executionMode: config.EXECUTION_MODE,
    liveExecutionEnabled: config.FEATURE_FLAG_LIVE_EXECUTION,
  });
}
