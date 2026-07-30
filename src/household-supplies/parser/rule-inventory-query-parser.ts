import type {
  InventoryQueryParser,
} from "./inventory-query-parser.js";

import type {
  InventoryQueryProposal,
} from "../types.js";

export class RuleInventoryQueryParser
  implements InventoryQueryParser
{
  async parse(
    text: string,
    workspaceId: string,
  ): Promise<InventoryQueryProposal> {
    const normalized =
      text.replace(/\s+/g, "");

    if (
      normalized.includes("냉장고") ||
      normalized.includes("재고") ||
      normalized.includes("뭐있") ||
      normalized.includes("뭐있지") ||
      normalized.includes("뭐가있")
    ) {
      return {
        intent: "inventory_list",
        targetPlugin: "household-supplies",
        workspaceId,
        productName: null,
        confidence: 1,
        requiresClarification: false,
      };
    }

    return {
      intent: null,
      targetPlugin: "household-supplies",
      workspaceId,
      productName: null,
      confidence: 0,
      requiresClarification: false,
      unsupportedReason: "unsupported_intent",
    };
  }
}
