import type { InventoryEventStore } from "./inventory-event-store.js";
import type { ExecuteInventoryCommand } from "./execute-inventory-command.js";
import type { UnitOfWork } from "./unit-of-work.js";

export class RevertLastReceipt {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: InventoryEventStore,
    private readonly executeInventoryCommand: ExecuteInventoryCommand,
  ) {}

  async execute(input: {
    workspaceId: string;
    householdId: string;
    actorId: string;
  }) {
    const latest =
      await this.unitOfWork.transaction(
        async (tx) =>
          this.eventStore.findLatestPurchase(
            tx,
            input.workspaceId,
          ),
      );

    if (!latest) {
      return {
        success: false,
        message:
          "취소할 최근 영수증이 없어요.",
      };
    }

    console.log(
      "[LATEST_RECEIPT_EVENT]",
      latest,
    );

    console.log(
      "[REVERT_ITEMS]",
      latest.payload.items,
    );

    console.log(
      "[REVERT_COMMAND]",
      {
        type: "ConsumeInventory",
        items:
          latest.payload.items,
      },
    );

    const consumeResult =
      await this.executeInventoryCommand.execute({
        type: "ConsumeInventory",
      workspaceId:
        input.workspaceId,
      householdId:
        input.householdId,
      actorId:
        input.actorId,
      commandId:
        crypto.randomUUID(),
      correlationId:
        crypto.randomUUID(),
      idempotencyKey:
        crypto.randomUUID(),
      items:
        latest.payload.items.map(
          (item) => ({
            canonicalProductId:
              item.canonicalProductId,
            canonicalName:
              item.canonicalName,

            rawName:
              item.rawName ?? item.canonicalName,

            quantity:
              item.quantity,
            unit:
              item.unit,
          }),
        ),
    });

    console.log(
      "[CONSUME_RESULT]",
      consumeResult,
    );

    return {
      success: true,
      message:
        "마지막 영수증 내역을 취소했어요.",
    };
  }
}
