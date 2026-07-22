// Application — transaction boundary contract.
// Interface only; the PostgreSQL adapter is added in the DB step.

/**
 * Opaque transactional handle. The infrastructure adapter binds this to a
 * concrete client (e.g. a pg PoolClient) so domain code never imports a database
 * (see CLAUDE.md dependency rule).
 */
export interface Tx {}

export interface UnitOfWork {
  /**
   * Run `work` inside a single transaction. Commit on success; roll back if
   * `work` throws. All writes made through the bound `Tx` commit or roll back
   * together (ADR-006 synchronous projection + Slice 01 transaction boundary).
   */
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}
