import { Pool } from "pg";

/**
 * PostgreSQL connection pool factory.
 *
 * DATABASE_URL example:
 * postgres://lifeos:lifeos@localhost:5433/lifeos
 */
export function createPostgresPool(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return new Pool({
    connectionString: databaseUrl,
  });
}