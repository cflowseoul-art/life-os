import type {
  InventoryCommand,
} from "../../household-supplies/types.js";

import { randomUUID } from "crypto";


export class PatternCommandBuilder {

  build(
    pattern: {
      intent: string;
      payload: any;
    },
    context: {
      workspaceId: string;
      householdId: string;
      actorId: string;
    },
  ): InventoryCommand | null {

    if (
      pattern.intent !== "adjust_inventory"
    ) {
      return null;
    }


    return {
      type:
        "AdjustInventory",

      commandId:
        randomUUID(),

      idempotencyKey:
        randomUUID(),

      correlationId:
        randomUUID(),

      householdId:
        context.householdId,

      workspaceId:
        context.workspaceId,

      actorId:
        context.actorId,

      items:
        pattern.payload.items.map(
          (item: any) => ({
            canonicalProductId:
              item.canonicalProductId,

            canonicalName:
              item.rawName,

            quantity:
              item.quantity,

            unit:
              item.unit,

            rawName:
              item.rawName,
          }),
        ),
    };
  }
}
