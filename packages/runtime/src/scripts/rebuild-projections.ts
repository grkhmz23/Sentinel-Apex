import { config } from '@sentinel-apex/config';

import { SentinelRuntime } from '../runtime.js';

async function main(): Promise<void> {
  const runtime = await SentinelRuntime.createDeterministic(config.DATABASE_URL, {
    executionMode: config.EXECUTION_MODE,
    liveExecutionEnabled: config.FEATURE_FLAG_LIVE_EXECUTION,
  });

  try {
    const status = await runtime.rebuildProjections('runtime-script-rebuild');
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  } finally {
    await runtime.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
