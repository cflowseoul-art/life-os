/**
 * The database connection.
 *
 * Infrastructure. No domain module imports this file, and no capability knows
 * a database exists — adapters below implement the ports the domain declared.
 */

import { Pool } from "pg";

let pool: Pool | null = null;

export function db(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL이 설정되지 않았습니다.");

  pool = new Pool({
    connectionString,
    // Hosted Postgres terminates TLS; local docker does not.
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PGPOOL_MAX ?? 5),
  });

  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}
