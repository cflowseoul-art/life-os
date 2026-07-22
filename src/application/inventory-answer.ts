import type {
  InventoryItemState,
} from "../household-supplies/types.js";

export type InventoryAnswer = {
  message: string;
  items: InventoryItemState[];
};

export class InventoryAnswerGenerator {
  generate(
    items: InventoryItemState[],
  ): InventoryAnswer {
    if (items.length === 0) {
      return {
        message:
          "확인되는 재고가 없어요.",
        items,
      };
    }

    if (items.length === 1) {
      const item = items[0];

      return {
        message:
          `${item.canonicalName} ${item.quantity}${item.unit} 있어요.`,
        items,
      };
    }

    return {
      message:
        `현재 ${items.length}개의 재고가 있어요.`,
      items,
    };
  }
}
