import type { LlmClient } from "../llm-client.js";

export type InventoryLanguageIntent =
  | "inventory_query"
  | "purchase_inventory"
  | "consume_inventory"
  | "adjust_inventory";

type Result = {
  intent: InventoryLanguageIntent;
};

export class InventoryLanguageRouter {
  constructor(
    private readonly llmClient: LlmClient,
  ) {}

  async route(
    text: string,
  ): Promise<Result> {
    const response =
      await this.llmClient.generate(`
Return JSON only.

Classify the user's inventory intent.

Allowed intents:
- inventory_query
- purchase_inventory
- consume_inventory
- adjust_inventory

Examples:

"계란 몇 개 있어?"
=> {"intent":"inventory_query"}

"계란 한 판 샀어"
=> {"intent":"purchase_inventory"}

"계란 2개 먹었어"
=> {"intent":"consume_inventory"}

"계란 0개로 수정해줘"
=> {"intent":"adjust_inventory"}

User:
${text}
`);

    return JSON.parse(response);
  }
}
