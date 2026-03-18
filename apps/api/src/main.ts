import { config } from '@sentinel-apex/config';
import { createLogger } from '@sentinel-apex/observability';

import { createApp } from './app.js';

const logger = createLogger('api:main');

async function main(): Promise<void> {
  const app = await createApp();
  const port = config.API_PORT;

  await app.listen({ port, host: '0.0.0.0' });

  logger.info(`API listening on port ${port}`, {
    component: 'api:main',
  });
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
