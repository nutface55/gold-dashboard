import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let _db: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
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
