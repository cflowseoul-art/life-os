import type { ExecutedResult } from "../household-supplies/types.js";
import type { Tx } from "./unit-of-work.js";

export interface ProcessedCommandStore {
  findByIdempotencyKey(
    tx: Tx,
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<ExecutedResult | null>;

  save(
    tx: Tx,
    workspaceId: string,
    commandId: string,
    idempotencyKey: string,
    result: ExecutedResult,
  ): Promise<void>;
}
