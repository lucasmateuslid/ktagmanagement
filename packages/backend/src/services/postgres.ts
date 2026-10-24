import { Pool } from 'pg';

let pool: Pool | null = null;

/** PostgreSQL is opt-in while Firestore remains the production source. */
export function postgres(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não configurada.');
  pool ||= new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  return pool;
}

export async function closePostgres(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
