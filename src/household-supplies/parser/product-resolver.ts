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
    throw new Error(
      `Product resolver is not configured: ${item.rawName}`,
    );
  }
}
