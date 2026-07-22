import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  getPostgresClient,
  PostgresUnitOfWork,
} from "../src/infrastructure/postgres/postgres-unit-of-work.js";

function createMockDatabase() {
  const query = vi.fn();
  const release = vi.fn();

  const client = {
    query,
    release,
  } as unknown as PoolClient;

  const connect = vi.fn().mockResolvedValue(client);

  const pool = {
    connect,
  } as unknown as Pick<Pool, "connect">;

  return {
    pool,
    client,
    connect,
    query,
    release,
  };
}

describe("PostgresUnitOfWork", () => {
  it("commits when the work succeeds", async () => {
    const database = createMockDatabase();
    const unitOfWork = new PostgresUnitOfWork(database.pool);

    const result = await unitOfWork.transaction(async () => {
      return "success";
    });

    expect(result).toBe("success");
    expect(database.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(database.query).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(database.query).not.toHaveBeenCalledWith("ROLLBACK");
  });

  it("rolls back when the work throws", async () => {
    const database = createMockDatabase();
    const unitOfWork = new PostgresUnitOfWork(database.pool);
    const expectedError = new Error("work failed");

    await expect(
      unitOfWork.transaction(async () => {
        throw expectedError;
      }),
    ).rejects.toBe(expectedError);

    expect(database.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(database.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
    expect(database.query).not.toHaveBeenCalledWith("COMMIT");
  });

  it("always releases the acquired client after success", async () => {
    const database = createMockDatabase();
    const unitOfWork = new PostgresUnitOfWork(database.pool);

    await unitOfWork.transaction(async () => undefined);

    expect(database.release).toHaveBeenCalledTimes(1);
  });

  it("always releases the acquired client after failure", async () => {
    const database = createMockDatabase();
    const unitOfWork = new PostgresUnitOfWork(database.pool);

    await expect(
      unitOfWork.transaction(async () => {
        throw new Error("failure");
      }),
    ).rejects.toThrow("failure");

    expect(database.release).toHaveBeenCalledTimes(1);
  });

  it("passes the acquired client through the transaction handle", async () => {
    const database = createMockDatabase();
    const unitOfWork = new PostgresUnitOfWork(database.pool);

    await unitOfWork.transaction(async (tx) => {
      const client = getPostgresClient(tx);

      expect(client).toBe(database.client);
    });
  });
});