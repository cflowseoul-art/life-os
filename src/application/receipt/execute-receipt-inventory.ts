import type {
  ExecuteInventoryCommand,
} from "../execute-inventory-command.js";

import type {
  ProductResolver,
} from "../product-resolver.js";

import type {
  ProductCreator,
} from "../product-creator.js";

import type {
  ReceiptItem,
} from "./receipt-to-inventory-proposal.js";

import type {
  InventoryLine,
  PurchaseInventoryCommand,
} from "../../household-supplies/types.js";

export class ExecuteReceiptInventory {
  constructor(
    private readonly executeInventoryCommand:
      ExecuteInventoryCommand,

    private readonly productResolver:
      ProductResolver,

    private readonly productCreator:
      ProductCreator,
  ) {}

  async execute(input: {
    items: ReceiptItem[];
    workspaceId: string;
    householdId: string;
    actorId: string;
  }) {
    const inventoryLines: InventoryLine[] = [];

    for (const item of input.items) {
      const product =
        await this.productResolver.resolve(
          item.rawName,
        );

      console.log(
        "RECEIPT PRODUCT RESOLVE",
        item.rawName,
        product,
      );

      const resolvedProduct =
        product ??
        await this.productCreator.create({
          name:
            item.rawName,
          baseUnit:
            item.unit,
        });

      inventoryLines.push({
        canonicalProductId:
          resolvedProduct.canonicalProductId,

        canonicalName:
          resolvedProduct.canonicalName,

        rawName:
          item.rawName,

        quantity:
          item.quantity,

        unit:
          item.unit,
      });
    }

    if (inventoryLines.length === 0) {
      return {
        status: "failed",
        reason: "no_resolved_products",
      };
    }

    const command: PurchaseInventoryCommand = {
      type: "PurchaseInventory",

      sourceType:
        "receipt",

      commandId:
        crypto.randomUUID(),

      idempotencyKey:
        crypto.randomUUID(),

      correlationId:
        crypto.randomUUID(),

      workspaceId:
        input.workspaceId,

      householdId:
        input.householdId,

      actorId:
        input.actorId,

      items:
        inventoryLines,
    };

    return this.executeInventoryCommand.execute(
      command,
    );
  }
}
