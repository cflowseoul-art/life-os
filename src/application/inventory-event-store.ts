import type { Tx } from "./unit-of-work.js";
import type { InventoryEvent } from "../household-supplies/types.js";

export type StoredInventoryEvent = InventoryEvent & {
  seq: number;
};

export interface InventoryEventStore {
  append(
    tx: Tx,
    event: InventoryEvent,
  ): Promise<StoredInventoryEvent>;
}
