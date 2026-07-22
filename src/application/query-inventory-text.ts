import type {
  InventoryItemState,
} from "../household-supplies/types.js";

import {
  InventoryQueryParser,
} from "../household-supplies/parser/inventory-query-parser.js";

import type {
  GetInventory,
} from "./get-inventory.js";

export class QueryInventoryText {
  private readonly parser =
    new InventoryQueryParser();

  constructor(
    private readonly getInventory: GetInventory,
  ) {}

  async execute(
    input: {
      text: string;
      workspaceId: string;
    },
  ): Promise<InventoryItemState[] | null> {
    const proposal =
      this.parser.parse(
        input.text,
        input.workspaceId,
      );

    console.log("QUERY PROPOSAL", proposal);

    if (
      proposal.intent === null
      || proposal.productName === null
    ) {
      return null;
    }

    const inventory =
      await this.getInventory.execute(
        input.workspaceId,
      );

    return inventory.filter(
      (item) =>
        item.canonicalName ===
        proposal.productName,
    );
  }
}
