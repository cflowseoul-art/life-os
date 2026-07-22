import { describe, expect, it, vi } from "vitest";

import { ExecuteInventoryCommand } from "../src/application/execute-inventory-command.js";
import type {
  InventoryEventStore,
  StoredInventoryEvent,
} from "../src/application/inventory-event-store.js";
import type { InventoryProjector } from "../src/application/inventory-projector.js";
import type { ProcessedCommandStore } from "../src/application/processed-command-store.js";
import type {
  Tx,
  UnitOfWork,
} from "../src/application/unit-of-work.js";
import type {
  ExecutedResult,
  InventoryCommand,
  InventoryEvent,
} from "../src/household-supplies/types.js";

const tx: Tx = {};

const householdId =
  "11111111-1111-4111-8111-111111111111";

const workspaceId =
  "22222222-2222-4222-8222-222222222222";

const actorId =
  "33333333-3333-4333-8333-333333333333";

const commandId =
  "44444444-4444-4444-8444-444444444444";

const eventId =
  "55555555-5555-4555-8555-555555555555";

function createCommand(): InventoryCommand {
  return {
    type: "PurchaseInventory",
    commandId,
    idempotencyKey: "inventory-command-001",
    correlationId:
      "66666666-6666-4666-8666-666666666666",
    householdId,
    workspaceId,
    actorId,
    items: [
      {
        canonicalProductId:
          "77777777-7777-4777-8777-777777777777",
        canonicalName: "계란",
        quantity: 30,
        unit: "개",
        rawName: "계란 한 판",
      },
    ],
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

  const eventStore: InventoryEventStore = {
    append: vi.fn(
      async (
        _tx: Tx,
        event: InventoryEvent,
      ): Promise<StoredInventoryEvent> => ({
        ...event,
        seq: 1,
      }),
    ),
  };

  const inventoryProjector: InventoryProjector = {
    project: vi.fn(),
  };

  const processedCommandStore: ProcessedCommandStore = {
    findByIdempotencyKey: vi.fn(),
    save: vi.fn(),
  };

  return {
    unitOfWork,
    eventStore,
    inventoryProjector,
    processedCommandStore,
    getTransactionCallCount: () =>
      transactionCallCount,
  };
}

describe("ExecuteInventoryCommand", () => {
  it("stores an event, projects it, and stores the processed result", async () => {
    const dependencies = createDependencies();

    vi.mocked(
      dependencies.processedCommandStore
        .findByIdempotencyKey,
    ).mockResolvedValue(null);

    const service = new ExecuteInventoryCommand(
      dependencies.unitOfWork,
      dependencies.eventStore,
      dependencies.inventoryProjector,
      dependencies.processedCommandStore,
      () => eventId,
      () => "2026-07-22T03:00:00.000Z",
    );

    const command = createCommand();

    const result = await service.execute(command);

    expect(result).toEqual({
      status: "executed",
      intent: "purchase_inventory",
      eventId,
      items: command.items,
    });

    expect(
      dependencies.processedCommandStore
        .findByIdempotencyKey,
    ).toHaveBeenCalledWith(
      tx,
      workspaceId,
      "inventory-command-001",
    );

    expect(
      dependencies.eventStore.append,
    ).toHaveBeenCalledTimes(1);

    expect(
      dependencies.inventoryProjector.project,
    ).toHaveBeenCalledTimes(1);

    expect(
      dependencies.processedCommandStore.save,
    ).toHaveBeenCalledWith(
      tx,
      workspaceId,
      commandId,
      "inventory-command-001",
      result,
    );

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);
  });

  it("returns the previous result without creating another event", async () => {
    const dependencies = createDependencies();

    const previousResult: ExecutedResult = {
      status: "executed",
      intent: "purchase_inventory",
      eventId:
        "88888888-8888-4888-8888-888888888888",
      items: createCommand().items,
    };

    vi.mocked(
      dependencies.processedCommandStore
        .findByIdempotencyKey,
    ).mockResolvedValue(previousResult);

    const service = new ExecuteInventoryCommand(
      dependencies.unitOfWork,
      dependencies.eventStore,
      dependencies.inventoryProjector,
      dependencies.processedCommandStore,
    );

    const result = await service.execute(
      createCommand(),
    );

    expect(result).toEqual(previousResult);

    expect(
      dependencies.eventStore.append,
    ).not.toHaveBeenCalled();

    expect(
      dependencies.inventoryProjector.project,
    ).not.toHaveBeenCalled();

    expect(
      dependencies.processedCommandStore.save,
    ).not.toHaveBeenCalled();
  });

  it("does not save the processed result when projection fails", async () => {
    const dependencies = createDependencies();

    vi.mocked(
      dependencies.processedCommandStore
        .findByIdempotencyKey,
    ).mockResolvedValue(null);

    vi.mocked(
      dependencies.inventoryProjector.project,
    ).mockRejectedValue(
      new Error("projection failed"),
    );

    const service = new ExecuteInventoryCommand(
      dependencies.unitOfWork,
      dependencies.eventStore,
      dependencies.inventoryProjector,
      dependencies.processedCommandStore,
      () => eventId,
    );

    await expect(
      service.execute(createCommand()),
    ).rejects.toThrow("projection failed");

    expect(
      dependencies.processedCommandStore.save,
    ).not.toHaveBeenCalled();
  });
});
