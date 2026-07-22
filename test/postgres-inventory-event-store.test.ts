import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import { PostgresInventoryEventStore } from "../src/infrastructure/postgres/postgres-inventory-event-store.js";
import { PostgresUnitOfWork } from "../src/infrastructure/postgres/postgres-unit-of-work.js";
import type { InventoryEvent } from "../src/household-supplies/types.js";

function createEvent(): InventoryEvent {
  return {
    eventId: "11111111-1111-4111-8111-111111111111",
    eventType: "InventoryPurchased",
    eventVersion: 1,
    aggregateType: "inventory",
    aggregateId: "22222222-2222-4222-8222-222222222222",
    householdId: "33333333-3333-4333-8333-333333333333",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    actorId: "44444444-4444-4444-8444-444444444444",
    occurredAt: "2026-07-22T02:00:00.000Z",
    correlationId: "55555555-5555-4555-8555-555555555555",
    commandId: "66666666-6666-4666-8666-666666666666",
    idempotencyKey: "77777777-7777-4777-8777-777777777777",
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
    metadata: {
      source: "text",
      confidence: 1,
    },
  };
}

describe("PostgresInventoryEventStore", () => {
  it("inserts one event and returns its sequence", async () => {
    const query = vi.fn(
      async (sql: string, _parameters?: unknown[]) => {
        if (sql === "BEGIN" || sql === "COMMIT") {
          return { rows: [] };
        }

        return {
          rows: [{ seq: "42" }],
        };
      },
    );

    const release = vi.fn();

    const client = {
      query,
      release,
    } as unknown as PoolClient;

    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pick<Pool, "connect">;

    const unitOfWork = new PostgresUnitOfWork(pool);
    const eventStore = new PostgresInventoryEventStore();
    const event = createEvent();

    const storedEvent = await unitOfWork.transaction(
      async (tx) => eventStore.append(tx, event),
    );

    expect(storedEvent).toEqual({
      ...event,
      seq: 42,
    });

    const insertCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO inventory_events"),
    );

    expect(insertCall).toBeDefined();

    if (!insertCall) {
      throw new Error("INSERT call not found");
    }

    const [, parameters] = insertCall;

    expect(parameters?.[0]).toBe(event.eventId);
    expect(parameters?.[1]).toBe("InventoryPurchased");
    expect(parameters?.[13]).toBe(
      JSON.stringify(event.payload),
    );

    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("throws when the insert returns no sequence", async () => {
    const query = vi.fn(
      async (sql: string, _parameters?: unknown[]) => {
        if (sql === "BEGIN" || sql === "ROLLBACK") {
          return { rows: [] };
        }

        return { rows: [] };
      },
    );

    const client = {
      query,
      release: vi.fn(),
    } as unknown as PoolClient;

    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pick<Pool, "connect">;

    const unitOfWork = new PostgresUnitOfWork(pool);
    const eventStore = new PostgresInventoryEventStore();

    await expect(
      unitOfWork.transaction((tx) =>
        eventStore.append(tx, createEvent()),
      ),
    ).rejects.toThrow(
      "Inventory event insert returned no row",
    );

    expect(query).toHaveBeenCalledWith("ROLLBACK");
  });
});