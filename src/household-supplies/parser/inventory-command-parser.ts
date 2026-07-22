import type {
  CommandProposal,
} from "../types.js";

export interface InventoryCommandParser {
  parse(
    text: string,
    workspaceId: string,
  ): Promise<CommandProposal>;
}
