import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import { PostgresProcessedCommandStore } from "../src/infrastructure/postgres/postgres-processed-command-store.js";
import { PostgresUnitOfWork } from "../src/infrastructure/postgres/postgres-unit-of-work.js";
import type { ExecutedResult } from "../src/household-supplies/types.js";

const workspaceId =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createResult(): ExecutedResult {
  return {
    status: "executed",
    intent: "purchase_inventory",
    eventId:
      "11111111-1111-4111-8111-111111111111",
    items: [
      {
        canonicalProductId:
          "22222222-2222-4222-8222-222222222222",
        canonicalName: "계란",
        quantity: 30,
        unit: "개",
        rawName: "계란 한 판",
      },
    ],
  };
}

function createMockDatabase(
  rows: unknown[] = [],
) {
  const query = vi.fn(
    async (
      sql: string,
      _parameters?: unknown[],
    ) => {
      if (
        sql === "BEGIN"
        || sql === "COMMIT"
        || sql === "ROLLBACK"
      ) {
        return {
          rows: [],
        };
      }

      return {
        rows,
      };
    },
  );

  const client = {
    query,
    release: vi.fn(),
  } as unknown as PoolClient;

  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pick<Pool, "connect">;

  return {
    pool,
    query,
  };
}

describe("PostgresProcessedCommandStore", () => {
  it("returns a result scoped to workspace and idempotency key", async () => {
    const previousResult = createResult();

    const database = createMockDatabase([
      {
        response: previousResult,
      },
    ]);

    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const store =
      new PostgresProcessedCommandStore();

    const result = await unitOfWork.transaction(
      (tx) =>
        store.findByIdempotencyKey(
          tx,
          workspaceId,
          "inventory-command-001",
        ),
    );

    expect(result).toEqual(previousResult);

    const selectCall =
      database.query.mock.calls.find(([sql]) =>
        String(sql).includes(
          "FROM processed_commands",
        ),
      );

    expect(selectCall).toBeDefined();

    if (!selectCall) {
      throw new Error(
        "Processed command SELECT not found",
      );
    }

    const [, parameters] = selectCall;

    expect(parameters).toEqual([
      workspaceId,
      "inventory-command-001",
    ]);
  });

  it("returns null when the command does not exist", async () => {
    const database = createMockDatabase();

    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const store =
      new PostgresProcessedCommandStore();

    const result = await unitOfWork.transaction(
      (tx) =>
        store.findByIdempotencyKey(
          tx,
          workspaceId,
          "missing-command",
        ),
    );

    expect(result).toBeNull();
  });

  it("stores response with workspace-scoped conflict handling", async () => {
    const database = createMockDatabase();

    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const store =
      new PostgresProcessedCommandStore();

    const result = createResult();

    await unitOfWork.transaction((tx) =>
      store.save(
        tx,
        workspaceId,
        "33333333-3333-4333-8333-333333333333",
        "inventory-command-001",
        result,
      ),
    );

    const insertCall =
      database.query.mock.calls.find(([sql]) =>
        String(sql).includes(
          "INSERT INTO processed_commands",
        ),
      );

    expect(insertCall).toBeDefined();

    if (!insertCall) {
      throw new Error(
        "Processed command INSERT not found",
      );
    }

    const [sql, parameters] = insertCall;

    expect(String(sql)).toContain("response");
    expect(String(sql)).toContain(
      "workspace_id",
    );

    expect(parameters).toEqual([
      workspaceId,
      "33333333-3333-4333-8333-333333333333",
      "inventory-command-001",
      JSON.stringify(result),
    ]);
  });
});
