import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DatabaseConnection } from './client.js';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

interface AppliedMigrationRow extends Record<string, unknown> {
  filename: string;
}

/**
 * Split SQL content into statements, respecting dollar-quoted strings
 * and not splitting on semicolons inside function bodies.
 */
function splitSqlStatements(content: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote: string | null = null;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    // Check for dollar quote start (e.g., $$ or $func$)
    if (!inDollarQuote && char === '$') {
      // Look for dollar quote tag
      let tag = '$';
      let j = i + 1;
      while (j < content.length) {
        const c = content[j];
        if (c === undefined) break;
        if (c === '$') {
          tag += '$';
          break;
        }
        if (!/[a-zA-Z0-9_]/.test(c)) break;
        tag += c;
        j++;
      }
      if (tag.length > 1 && tag.endsWith('$')) {
        inDollarQuote = tag;
        current += tag;
        i = j + 1;
        continue;
      }
    }
    // Check for dollar quote end
    else if (inDollarQuote && content.substring(i, i + inDollarQuote.length) === inDollarQuote) {
      current += content.substring(i, i + inDollarQuote.length);
      i += inDollarQuote.length;
      inDollarQuote = null;
      continue;
    }

    // Check for statement terminator (semicolon followed by newline or end)
    if (!inDollarQuote && char === ';') {
      // Check if this is a real statement end (followed by newline or end of string)
      const rest = content.substring(i + 1);
      if (rest.match(/^\s*(\n|$)/)) {
        current += char;
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        current = '';
        i++;
        continue;
      }
    }

    current += char;
    i++;
  }

  // Handle any remaining content
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
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
    const statements = splitSqlStatements(contents);

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
