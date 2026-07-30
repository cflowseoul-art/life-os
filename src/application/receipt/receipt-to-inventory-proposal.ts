export type ReceiptItem = {
  rawName: string;
  quantity: number;
  unit: string;
};

export class ReceiptToInventoryProposal {
  build(
    items: ReceiptItem[],
  ) {
    return {
      intent: "purchase_inventory",
      items: items.map((item) => ({
        rawName: item.rawName,
        quantity: item.quantity,
        unit: item.unit,
      })),
      confidence: 1,
      requiresClarification: false,
    };
  }
}
