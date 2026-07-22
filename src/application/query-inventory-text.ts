import type {
  InventoryItemState,
} from "../household-supplies/types.js";

import type {
  InventoryQueryParser,
} from "../household-supplies/parser/inventory-query-parser.js";

import type {
  GetInventory,
} from "./get-inventory.js";

export class QueryInventoryText {
  constructor(
    private readonly getInventory: GetInventory,
    private readonly parser: InventoryQueryParser,
  ) {}

  async execute(
    input: {
      text: string;
      workspaceId: string;
    },
  ): Promise<InventoryItemState[] | null> {
    const proposal =
      await this.parser.parse(
        input.text,
        input.workspaceId,
      );

    console.log("QUERY PROPOSAL", proposal);

    if (
      proposal.intent === null
    ) {
      return null;
    }

    const inventory =
      await this.getInventory.execute(
        input.workspaceId,
      );

    if (
      proposal.intent === "inventory_list"
    ) {
      return inventory;
    }

    if (
      proposal.productName === null
    ) {
      return null;
    }

    return inventory.filter(
      (item) =>
        item.canonicalName ===
        proposal.productName,
    );
  }
}
