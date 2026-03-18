import { applyMigrations, createDatabaseConnection } from '@sentinel-apex/db';

import { SentinelRuntime } from '../runtime.js';

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];

  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL is required');
  }

  const connection = await createDatabaseConnection(connectionString);
  await applyMigrations(connection);
  await connection.close();

  const runtime = await SentinelRuntime.createDeterministic(connectionString);
  const result = await runtime.runCycle('dev-script');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await runtime.close();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
