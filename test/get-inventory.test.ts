import { describe, expect, it, vi } from "vitest";

import { GetInventory } from "../src/application/get-inventory.js";
import type { InventoryQueryStore } from "../src/application/inventory-query-store.js";
import type {
  Tx,
  UnitOfWork,
} from "../src/application/unit-of-work.js";
import type { InventoryItemState } from "../src/household-supplies/types.js";

const tx: Tx = {};

function createInventoryItem(
  overrides: Partial<InventoryItemState> = {},
): InventoryItemState {
  return {
    workspaceId:
      "11111111-1111-4111-8111-111111111111",
    canonicalProductId:
      "22222222-2222-4222-8222-222222222222",
    canonicalName: "계란",
    quantity: 30,
    unit: "개",
    lastVerifiedAt: "2026-07-22T00:00:00.000Z",
    sourceType: "explicit_text",
    valueType: "explicit_quantity",
    freshnessStatus: "fresh",
    lastSeq: 1,
    ...overrides,
  };
}

function createDependencies() {
  let transactionCallCount = 0;

  const unitOfWork: UnitOfWork = {
    async transaction<T>(
      work: (transaction: Tx) => Promise<T>,
    ): Promise<T> {
      transactionCallCount += 1;
      return work(tx);
    },
  };

  const inventoryQueryStore: InventoryQueryStore = {
    findAvailableByWorkspaceId: vi.fn(),
  };

  return {
    unitOfWork,
    inventoryQueryStore,
    getTransactionCallCount: () => transactionCallCount,
  };
}

describe("GetInventory", () => {
  it("returns available inventory items for a workspace", async () => {
    const dependencies = createDependencies();

    const workspaceId =
      "11111111-1111-4111-8111-111111111111";

    const items = [
      createInventoryItem(),
      createInventoryItem({
        canonicalProductId:
          "33333333-3333-4333-8333-333333333333",
        canonicalName: "우유",
        quantity: 2,
        unit: "팩",
        lastSeq: 2,
      }),
    ];

    vi.mocked(
      dependencies.inventoryQueryStore
        .findAvailableByWorkspaceId,
    ).mockResolvedValue(items);

    const service = new GetInventory(
      dependencies.unitOfWork,
      dependencies.inventoryQueryStore,
    );

    const result = await service.execute(workspaceId);

    expect(result).toEqual(items);

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);

    expect(
      dependencies.inventoryQueryStore
        .findAvailableByWorkspaceId,
    ).toHaveBeenCalledWith(tx, workspaceId);
  });

  it("returns an empty array when no inventory exists", async () => {
    const dependencies = createDependencies();

    vi.mocked(
      dependencies.inventoryQueryStore
        .findAvailableByWorkspaceId,
    ).mockResolvedValue([]);

    const service = new GetInventory(
      dependencies.unitOfWork,
      dependencies.inventoryQueryStore,
    );

    const result = await service.execute(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual([]);
    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);
  });

  it("rejects an empty workspace id", async () => {
    const dependencies = createDependencies();

    const service = new GetInventory(
      dependencies.unitOfWork,
      dependencies.inventoryQueryStore,
    );

    await expect(
      service.execute("   "),
    ).rejects.toThrow("workspaceId is required");

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(0);

    expect(
      dependencies.inventoryQueryStore
        .findAvailableByWorkspaceId,
    ).not.toHaveBeenCalled();
  });

  it("propagates inventory storage failures", async () => {
    const dependencies = createDependencies();

    const storageError = new Error(
      "inventory query failed",
    );

    vi.mocked(
      dependencies.inventoryQueryStore
        .findAvailableByWorkspaceId,
    ).mockRejectedValue(storageError);

    const service = new GetInventory(
      dependencies.unitOfWork,
      dependencies.inventoryQueryStore,
    );

    await expect(
      service.execute(
        "11111111-1111-4111-8111-111111111111",
      ),
    ).rejects.toBe(storageError);

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);
  });
});
