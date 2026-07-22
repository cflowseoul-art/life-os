import type {
  InventoryQueryProposal,
} from "../types.js";

export class InventoryQueryParser {
  parse(
    text: string,
    workspaceId: string,
  ): InventoryQueryProposal {
    const normalized =
      text.trim();

    const isQuery =
      /(있어|남았어|남아|몇 개|얼마나|뭐 있어|무엇)/.test(
        normalized,
      );

    if (!isQuery) {
      return {
        intent: null,
        targetPlugin:
          "household-supplies",
        workspaceId,
        productName: null,
        confidence: 0,
        requiresClarification: true,
        unsupportedReason:
          "unsupported_intent",
      };
    }

    const productName =
      normalized
        .replace(
          /(몇 개|얼마나|있어|남았어|남아|뭐 있어|무엇|은|는|이|가|을|를|\?)/g,
          "",
        )
        .trim();

    if (!productName) {
      return {
        intent: "inventory_query",
        targetPlugin:
          "household-supplies",
        workspaceId,
        productName: null,
        confidence: 0.5,
        requiresClarification: true,
        unsupportedReason:
          "ambiguous_quantity",
      };
    }

    return {
      intent: "inventory_query",
      targetPlugin:
        "household-supplies",
      workspaceId,
      productName,
      confidence: 0.8,
      requiresClarification: false,
    };
  }
}
