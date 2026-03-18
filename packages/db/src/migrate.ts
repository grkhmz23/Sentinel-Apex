import { createDatabaseConnection } from './client.js';
import { applyMigrations } from './migrations.js';

async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];

  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const connection = await createDatabaseConnection(connectionString);

  try {
    const executed = await applyMigrations(connection);
    const suffix = executed.length === 0 ? 'no-op' : executed.join(', ');
    process.stdout.write(`[db] migrations complete: ${suffix}\n`);
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
