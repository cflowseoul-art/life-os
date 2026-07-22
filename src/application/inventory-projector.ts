import type { Tx } from "./unit-of-work.js";
import type { StoredInventoryEvent } from "./inventory-event-store.js";

export interface InventoryProjector {
  project(
    tx: Tx,
    event: StoredInventoryEvent,
  ): Promise<void>;
}