import type {
  InventoryQueryProposal,
} from "../types.js";

export interface InventoryQueryParser {
  parse(
    text: string,
    workspaceId: string,
  ): Promise<InventoryQueryProposal>;
}
