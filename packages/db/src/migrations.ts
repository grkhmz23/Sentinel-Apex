import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DatabaseConnection } from './client.js';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

interface AppliedMigrationRow extends Record<string, unknown> {
  filename: string;
}

export async function applyMigrations(connection: DatabaseConnection): Promise<string[]> {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRows = await connection.query<AppliedMigrationRow>(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC;',
  );
  const applied = new Set(appliedRows.map((row) => row.filename));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  const executed: string[] = [];

  for (const filename of files) {
    if (applied.has(filename)) {
      continue;
    }

    const contents = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
    const statements = contents
      .split(/;\s*\n/g)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await connection.execute(`${statement};`);
    }

    await connection.execute(
      `INSERT INTO schema_migrations (filename) VALUES ('${filename.replace(/'/g, "''")}');`,
    );
    executed.push(filename);
  }

  return executed;
}
