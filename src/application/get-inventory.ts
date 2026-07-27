import type { InventoryItemState } from "../household-supplies/types.js";

export type InventoryListItem = InventoryItemState & {
  label: "NEW" | "OLD";
};
import type { InventoryQueryStore } from "./inventory-query-store.js";
import type { UnitOfWork } from "./unit-of-work.js";

export class GetInventory {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly inventoryQueryStore: InventoryQueryStore,
  ) {}

  async execute(
    workspaceId: string,
  ): Promise<InventoryListItem[]> {
    if (workspaceId.trim().length === 0) {
      throw new Error("workspaceId is required");
    }

    const items =
      await this.unitOfWork.transaction(async (tx) =>
        this.inventoryQueryStore.findAvailableByWorkspaceId(
          tx,
          workspaceId,
        ),
      );

    const TWO_WEEKS =
      14 * 24 * 60 * 60 * 1000;

    return items.map((item) => ({
      ...item,
      label:
        Date.now() -
          new Date(item.lastVerifiedAt).getTime()
          < TWO_WEEKS
          ? "NEW"
          : "OLD",
    }));
  }
}