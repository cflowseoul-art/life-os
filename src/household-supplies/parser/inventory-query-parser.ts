import type {
  InventoryQueryProposal,
} from "../types.js";

import {
  QueryLanguageAnalyzer,
} from "./language/query-language-analyzer.js";


export class InventoryQueryParser {
  private readonly languageAnalyzer =
    new QueryLanguageAnalyzer();

  parse(
    text: string,
    workspaceId: string,
  ): InventoryQueryProposal {
    const analysis =
      this.languageAnalyzer.analyze(
        text,
      );

    if (!analysis.isQuery) {
      return {
        intent: null,
        targetPlugin:
          "household-supplies",
        workspaceId,
        productName: null,
        confidence: 0,
        requiresClarification: false,
        unsupportedReason:
          "unsupported_intent",
      };
    }


    const isListQuery =
      /(냉장고|뭐 있어|무엇|남은 재료|재료 알려줘|남은 것|남은거)/.test(
        analysis.normalizedText,
      );

    if (isListQuery) {
      return {
        intent: "inventory_list",
        targetPlugin:
          "household-supplies",
        workspaceId,
        productName: null,
        confidence: 0.8,
        requiresClarification: false,
      };
    }


    const productName =
      analysis.cleanedText
        .replace(
          /(은|는|이|가|을|를)$/g,
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
