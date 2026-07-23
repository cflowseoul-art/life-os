import { randomUUID } from "node:crypto";

import type {
  CommandProposal,
  InventoryCommand,
  InventoryLine,
} from "../household-supplies/types.js";

import type {
  ProductResolver,
} from "./product-resolver.js";

import type {
  UnitConversionResolver,
} from "./unit-conversion-resolver.js";

export class ResolveInventoryProposal {
  constructor(
    private readonly productResolver: ProductResolver,
    private readonly unitConversionResolver: UnitConversionResolver,
  ) {}

  async execute(
    proposal: CommandProposal,
    context: {
      householdId: string;
      actorId: string;
    },
  ): Promise<InventoryCommand | null> {
    if (
      proposal.intent === null
      || proposal.items.length === 0
    ) {
      return null;
    }

    const items: InventoryLine[] = [];

    for (const item of proposal.items) {
      const product =
        await this.productResolver.resolve(
          item.rawName,
        );

      if (!product) {
        console.log("PRODUCT RESOLVE FAILED", item);
        return null;
      }

      console.log("PRODUCT RESOLVED", product);

      let quantity =
        item.quantity;

      let unit =
        item.unit;

      console.log("BEFORE UNIT CONVERSION");

      const factor =
        await this.unitConversionResolver.resolve(
          {} as never,
          {
            canonicalProductId:
              product.canonicalProductId,
            fromUnit:
              item.unit,
          },
        );

      console.log("UNIT FACTOR", factor);

      if (factor !== null) {
        quantity =
          quantity * factor;

        unit =
          "개";
      }

      items.push({
        canonicalProductId:
          product.canonicalProductId,
        canonicalName:
          product.canonicalName,
        quantity,
        unit,
        rawName:
          item.rawName,
      });
    }

    let commandType:
      | "PurchaseInventory"
      | "ConsumeInventory"
      | "AdjustInventory";

    switch (proposal.intent) {
      case "purchase_inventory":
        commandType = "PurchaseInventory";
        break;

      case "consume_inventory":
        commandType = "ConsumeInventory";
        break;

      case "adjust_inventory":
        commandType = "AdjustInventory";
        break;

      default:
        return null;
    }

    return {
      type: commandType,
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
      householdId:
        context.householdId,
      workspaceId:
        proposal.workspaceId,
      actorId:
        context.actorId,
      items,
    };
  }
}
