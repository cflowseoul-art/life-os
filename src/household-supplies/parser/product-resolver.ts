import type {
  InventoryLine,
  ProposedItem,
} from "../types.js";

export interface ProductResolver {
  resolve(
    item: ProposedItem,
  ): Promise<InventoryLine>;
}

export class SimpleProductResolver
  implements ProductResolver
{
  async resolve(
    item: ProposedItem,
  ): Promise<InventoryLine> {
    if (
      item.canonicalProductId === null
      || item.canonicalName === null
    ) {
      throw new Error(
        `Product not resolved: ${item.rawName}`,
      );
    }

    return {
      canonicalProductId:
        item.canonicalProductId,
      canonicalName:
        item.canonicalName,
      quantity:
        item.quantity,
      unit:
        item.unit,
      rawName:
        item.rawName,
    };
  }
}
