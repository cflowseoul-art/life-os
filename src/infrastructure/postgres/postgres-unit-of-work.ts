import type { Pool, PoolClient } from "pg";

import type {
  Tx,
  UnitOfWork,
} from "../../application/unit-of-work.js";

/**
 * PostgreSQL transaction handle.
 *
 * Application/domain code sees only the Tx interface.
 * PostgreSQL repositories can obtain the bound PoolClient through
 * getPostgresClient().
 */
class PostgresTx implements Tx {
  constructor(readonly client: PoolClient) {}
}

/**
 * Extract the PostgreSQL client bound to the current transaction.
 *
 * This will later be used by PostgreSQL repository adapters.
 */
export function getPostgresClient(tx: Tx): PoolClient {
  if (!(tx instanceof PostgresTx)) {
    throw new Error("Expected a PostgreSQL transaction");
  }

  return tx.client;
}

/**
 * Minimal pool contract required by the UnitOfWork.
 *
 * Using this smaller type makes the class easy to unit-test without
 * connecting to a real database.
 */
type ConnectablePool = Pick<Pool, "connect">;

export class PostgresUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: ConnectablePool) {}

  async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await work(new PostgresTx(client));

      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original application/database error.
      }

      throw error;
    } finally {
      client.release();
    }
  }
}