import type {
  CommandProposal,
} from "../../src/household-supplies/types.js";

export type InventoryCommandParserCase = {
  name: string;
  input: string;
  expected: Partial<CommandProposal>;
};

export const inventoryCommandParserCases:
  InventoryCommandParserCase[] = [
    {
      name: "purchase with Korean unit",
      input: "계란 한 판 샀어",
      expected: {
        intent: "purchase_inventory",
        requiresClarification: false,
        items: [
          {
            rawName: "계란",
            quantity: 1,
            unit: "판",
          },
        ],
      },
    },
    {
      name: "consume inventory",
      input: "계란 2개 먹었어",
      expected: {
        intent: "consume_inventory",
        requiresClarification: false,
        items: [
          {
            rawName: "계란",
            quantity: 2,
            unit: "개",
          },
        ],
      },
    },
    {
      name: "unsupported text",
      input: "오늘 날씨 좋아",
      expected: {
        intent: null,
        requiresClarification: true,
      },
    },
  ];
