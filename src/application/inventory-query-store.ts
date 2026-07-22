import type { InventoryItemState } from "../household-supplies/types.js";
import type { Tx } from "./unit-of-work.js";

export interface InventoryQueryStore {
  findAvailableByWorkspaceId(
    tx: Tx,
    workspaceId: string,
  ): Promise<InventoryItemState[]>;
}