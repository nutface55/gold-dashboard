import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _db: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  // Vercel Storage (Neon) may use POSTGRES_URL or DATABASE_URL depending on how it was connected
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error('No database connection string found (DATABASE_URL / POSTGRES_URL)');
  }
  if (!_db) {
    _db = neon(connectionString);
  }
  return _db;
}

// Neon supports parameterized queries via the unsafe() method for dynamic SQL
// For DDL (schema/seed), we use the tagged template literal form
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = getDb();
  // neon supports parameterized queries directly when called as a function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db as any)(sql, params);
  return result as T[];
}

export async function queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
