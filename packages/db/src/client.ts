import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

type PostgresDrizzle = ReturnType<typeof drizzlePostgres<typeof schema>>;
export type Database = PostgresDrizzle;

type DriverType = 'postgres' | 'pglite';

export interface DatabaseConnection {
  readonly db: Database;
  readonly driver: DriverType;
  execute(sqlText: string): Promise<void>;
  query<TRecord extends Record<string, unknown>>(sqlText: string): Promise<TRecord[]>;
  close(): Promise<void>;
}

const connectionCache = new Map<string, Promise<DatabaseConnection>>();

function isPGliteConnectionString(connectionString: string): boolean {
  return connectionString.startsWith('file:') || connectionString.startsWith('pglite:');
}

function resolvePGliteDataDir(connectionString: string): string | undefined {
  if (connectionString === 'pglite://memory' || connectionString === 'file::memory:') {
    return undefined;
  }

  if (connectionString.startsWith('pglite://')) {
    return connectionString.slice('pglite://'.length);
  }

  if (connectionString.startsWith('file://')) {
    const url = new URL(connectionString);
    return decodeURIComponent(url.pathname);
  }

  return undefined;
}

async function createPGliteConnection(connectionString: string): Promise<DatabaseConnection> {
  const [{ PGlite }, { drizzle: drizzlePglite }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ]);
  const dataDir = resolvePGliteDataDir(connectionString);
  const client = dataDir === undefined ? new PGlite() : new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });

  return {
    db: db as unknown as Database,
    driver: 'pglite',
    async execute(sqlText: string): Promise<void> {
      await client.exec(sqlText);
    },
    async query<TRecord extends Record<string, unknown>>(sqlText: string): Promise<TRecord[]> {
      const result = await client.query(sqlText);
      return result.rows as unknown as TRecord[];
    },
    async close(): Promise<void> {
      await client.close();
      connectionCache.delete(connectionString);
    },
  };
}

function createPostgresConnection(connectionString: string): DatabaseConnection {
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzlePostgres(client, { schema });

  return {
    db,
    driver: 'postgres',
    async execute(sqlText: string): Promise<void> {
      await client.unsafe(sqlText);
    },
    async query<TRecord extends Record<string, unknown>>(sqlText: string): Promise<TRecord[]> {
      const result = await client.unsafe(sqlText);
      return result as unknown as TRecord[];
    },
    async close(): Promise<void> {
      await client.end({ timeout: 5 });
      connectionCache.delete(connectionString);
    },
  };
}

export async function createDatabaseConnection(
  connectionString: string,
): Promise<DatabaseConnection> {
  if (connectionCache.has(connectionString)) {
    return connectionCache.get(connectionString) as Promise<DatabaseConnection>;
  }

  const connectionPromise = isPGliteConnectionString(connectionString)
    ? createPGliteConnection(connectionString)
    : Promise.resolve(createPostgresConnection(connectionString));

  connectionCache.set(connectionString, connectionPromise);
  return connectionPromise;
}

export async function getDb(connectionString: string): Promise<Database> {
  const connection = await createDatabaseConnection(connectionString);
  return connection.db;
}

export async function closeAllDatabases(): Promise<void> {
  const connections = await Promise.all(connectionCache.values());
  await Promise.all(
    connections.map(async (connection) => {
      try {
        await connection.close();
      } catch {
        connectionCache.clear();
      }
    }),
  );
  connectionCache.clear();
}

export function resetDatabaseConnectionCache(): void {
  connectionCache.clear();
}
