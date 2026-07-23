import { randomUUID } from "node:crypto";

import type {
  ExecutedResult,
  InventoryCommand,
  InventoryEvent,
  InventoryEventType,
  IntentName,
} from "../household-supplies/types.js";
import type { InventoryEventStore } from "./inventory-event-store.js";
import type { InventoryProjector } from "./inventory-projector.js";
import type { ProcessedCommandStore } from "./processed-command-store.js";
import type { UnitOfWork } from "./unit-of-work.js";

type CreateId = () => string;
type GetCurrentTime = () => string;

export class ExecuteInventoryCommand {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: InventoryEventStore,
    private readonly inventoryProjector: InventoryProjector,
    private readonly processedCommandStore: ProcessedCommandStore,
    private readonly createId: CreateId = randomUUID,
    private readonly getCurrentTime: GetCurrentTime = () =>
      new Date().toISOString(),
  ) {}

  async execute(
    command: InventoryCommand,
  ): Promise<ExecutedResult> {
    return this.unitOfWork.transaction(async (tx) => {
      const previousResult =
        await this.processedCommandStore.findByIdempotencyKey(
          tx,
          command.workspaceId,
          command.idempotencyKey,
        );

      if (previousResult) {
        return previousResult;
      }

      const event = this.createEvent(command);

      const storedEvent = await this.eventStore.append(
        tx,
        event,
      );

      await this.inventoryProjector.project(
        tx,
        storedEvent,
      );

      const result: ExecutedResult = {
        status: "executed",
        intent: this.toIntent(command),
        eventId: storedEvent.eventId,
        items: storedEvent.payload.items,
      };

      await this.processedCommandStore.save(
        tx,
        command.workspaceId,
        command.commandId,
        command.idempotencyKey,
        result,
      );

      return result;
    });
  }

  private createEvent(
    command: InventoryCommand,
  ): InventoryEvent {
    return {
      eventId: this.createId(),
      eventType: this.toEventType(command),
      eventVersion: 1,
      aggregateType: "inventory",
      aggregateId: command.workspaceId,
      householdId: command.householdId,
      workspaceId: command.workspaceId,
      actorId: command.actorId,
      occurredAt: this.getCurrentTime(),
      correlationId: command.correlationId,
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      payload: {
        items: command.items,
      },
      metadata: {
        source: "text",
        confidence: 1,
      },
    };
  }

  private toEventType(
    command: InventoryCommand,
  ): InventoryEventType {
    switch (command.type) {
      case "PurchaseInventory":
        return "InventoryPurchased";

      case "ConsumeInventory":
        return "InventoryConsumed";

      case "AdjustInventory":
        return "InventoryAdjusted";
    }
  }

  private toIntent(
    command: InventoryCommand,
  ): IntentName {
    switch (command.type) {
      case "PurchaseInventory":
        return "purchase_inventory";

      case "ConsumeInventory":
        return "consume_inventory";

      case "AdjustInventory":
        return "adjust_inventory";
    }
  }
}
