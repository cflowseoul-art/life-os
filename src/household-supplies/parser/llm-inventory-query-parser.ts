import type {
  LlmClient,
} from "../../application/llm-client.js";

import type {
  InventoryQueryParser,
} from "./inventory-query-parser.js";

import type {
  InventoryQueryProposal,
} from "../types.js";

import {
  validateQueryProposal,
} from "../../application/query-proposal-validator.js";


export class LlmInventoryQueryParser
  implements InventoryQueryParser
{
  constructor(
    private readonly llmClient: LlmClient,
  ) {}

  async parse(
    text: string,
    workspaceId: string,
  ): Promise<InventoryQueryProposal> {
    const response =
      await this.llmClient.generate(
        this.buildPrompt(text),
      );

    const parsed =
      JSON.parse(
        response,
      );

    return validateQueryProposal(
      parsed,
      workspaceId,
    );
  }

  private buildPrompt(
    input: string,
  ): string {
    return `
Convert the user's inventory query into JSON.

Rules:
- Return JSON only.
- Do not include markdown.
- Do not change inventory.
- Only understand user's intent.

Schema:
{
  "intent": "inventory_query" | "inventory_list" | null,
  "productName": string | null,
  "confidence": number,
  "requiresClarification": boolean,
  "unsupportedReason":
    "unsupported_intent" |
    "unknown_product" |
    "ambiguous_quantity" |
    "insufficient_recorded_stock" optional
}

Examples:

User:
계란 없지?

JSON:
{
  "intent": "inventory_query",
  "productName": "계란",
  "confidence": 0.9,
  "requiresClarification": false
}

User:
냉장고 털어봐

JSON:
{
  "intent": "inventory_list",
  "productName": null,
  "confidence": 0.9,
  "requiresClarification": false
}

User input:
${input}
`;
  }
}
