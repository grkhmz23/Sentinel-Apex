import { config } from '@sentinel-apex/config';
import { createLogger } from '@sentinel-apex/observability';
import { RuntimeWorker } from '@sentinel-apex/runtime';

import { assertWorkerStartupSafety, logWorkerStartup } from './deployment.js';

const logger = createLogger('runtime-worker:main');

function getCycleIntervalMs(): number {
  const raw = process.env['RUNTIME_WORKER_CYCLE_INTERVAL_MS'];
  if (raw === undefined || raw === '') {
    return 60_000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    throw new Error('RUNTIME_WORKER_CYCLE_INTERVAL_MS must be an integer >= 1000');
  }

  return parsed;
}

async function main(): Promise<void> {
  assertWorkerStartupSafety();

  const cycleIntervalMs = getCycleIntervalMs();
  logWorkerStartup(cycleIntervalMs);

  const worker = await RuntimeWorker.createDeterministic(
    config.DATABASE_URL,
    {
      executionMode: config.EXECUTION_MODE,
      liveExecutionEnabled: config.FEATURE_FLAG_LIVE_EXECUTION,
    },
    {
      cycleIntervalMs,
    },
  );

  await worker.start();

  logger.info('Runtime worker started', {
    component: 'runtime-worker:main',
    cycleIntervalMs,
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Runtime worker stopping on ${signal}`, {
      component: 'runtime-worker:main',
    });
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((error: unknown) => {
  console.error('Runtime worker failed to start:', error);
  process.exit(1);
});
