import type { InventoryItemState } from "../household-supplies/types.js";
import type { InventoryQueryStore } from "./inventory-query-store.js";
import type { UnitOfWork } from "./unit-of-work.js";

export class GetInventory {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly inventoryQueryStore: InventoryQueryStore,
  ) {}

  async execute(
    workspaceId: string,
  ): Promise<InventoryItemState[]> {
    if (workspaceId.trim().length === 0) {
      throw new Error("workspaceId is required");
    }

    return this.unitOfWork.transaction(async (tx) =>
      this.inventoryQueryStore.findAvailableByWorkspaceId(
        tx,
        workspaceId,
      ),
    );
  }
}