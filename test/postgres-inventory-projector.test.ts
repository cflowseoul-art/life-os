import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import type { StoredInventoryEvent } from "../src/application/inventory-event-store.js";
import { PostgresInventoryProjector } from "../src/infrastructure/postgres/postgres-inventory-projector.js";
import { PostgresUnitOfWork } from "../src/infrastructure/postgres/postgres-unit-of-work.js";

function createStoredEvent(
  eventType:
    | "InventoryPurchased"
    | "InventoryConsumed",
): StoredInventoryEvent {
  return {
    seq: 42,
    eventId: "11111111-1111-4111-8111-111111111111",
    eventType,
    eventVersion: 1,
    aggregateType: "inventory",
    aggregateId:
      "22222222-2222-4222-8222-222222222222",
    householdId:
      "33333333-3333-4333-8333-333333333333",
    workspaceId:
      "22222222-2222-4222-8222-222222222222",
    actorId:
      "44444444-4444-4444-8444-444444444444",
    occurredAt: "2026-07-22T02:00:00.000Z",
    correlationId:
      "55555555-5555-4555-8555-555555555555",
    commandId:
      "66666666-6666-4666-8666-666666666666",
    idempotencyKey: "test-command",
    payload: {
      items: [
        {
          canonicalProductId:
            "88888888-8888-4888-8888-888888888888",
          canonicalName: "계란",
          quantity: 30,
          unit: "개",
          rawName: "계란 한 판",
        },
        {
          canonicalProductId:
            "99999999-9999-4999-8999-999999999999",
          canonicalName: "우유",
          quantity: 2,
          unit: "개",
          rawName: "우유 두 개",
        },
      ],
    },
  };
}

function createMockDatabase() {
  const query = vi.fn(
    async (_sql: string, _parameters?: unknown[]) => ({
      rows: [],
    }),
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

describe("PostgresInventoryProjector", () => {
  it("adds purchased quantities", async () => {
    const database = createMockDatabase();
    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const projector =
      new PostgresInventoryProjector();

    await unitOfWork.transaction((tx) =>
      projector.project(
        tx,
        createStoredEvent("InventoryPurchased"),
      ),
    );

    const projectionCalls =
      database.query.mock.calls.filter(([sql]) =>
        String(sql).includes(
          "INSERT INTO inventory_items",
        ),
      );

    expect(projectionCalls).toHaveLength(2);

    const firstCall = projectionCalls[0];

    if (!firstCall) {
      throw new Error("Projection query not found");
    }

    const [, parameters] = firstCall;

    expect(parameters).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "88888888-8888-4888-8888-888888888888",
      "계란",
      30,
      "개",
      "2026-07-22T02:00:00.000Z",
      "explicit_text",
      "explicit_quantity",
      "fresh",
      42,
    ]);
  });

  it("subtracts consumed quantities", async () => {
    const database = createMockDatabase();
    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const projector =
      new PostgresInventoryProjector();

    await unitOfWork.transaction((tx) =>
      projector.project(
        tx,
        createStoredEvent("InventoryConsumed"),
      ),
    );

    const projectionCalls =
      database.query.mock.calls.filter(([sql]) =>
        String(sql).includes(
          "INSERT INTO inventory_items",
        ),
      );

    const firstCall = projectionCalls[0];

    if (!firstCall) {
      throw new Error("Projection query not found");
    }

    const [, parameters] = firstCall;

    expect(parameters?.[3]).toBe(-30);
  });
});