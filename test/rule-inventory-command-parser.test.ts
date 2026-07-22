import { describe, expect, it } from "vitest";

import { RuleInventoryCommandParser } from "../src/household-supplies/parser/rule-inventory-command-parser.js";

const workspaceId =
  "22222222-2222-4222-8222-222222222222";

describe("RuleInventoryCommandParser", () => {
  const parser =
    new RuleInventoryCommandParser();

  it("parses purchase inventory text", async () => {
    const result =
      await parser.parse(
        "계란 한 판 샀어",
        workspaceId,
      );

    expect(result.intent)
      .toBe("purchase_inventory");

    expect(result.items)
      .toHaveLength(1);

    expect(result.items[0])
      .toMatchObject({
        rawName: "계란",
        quantity: 1,
        unit: "판",
      });

    expect(result.requiresClarification)
      .toBe(false);
  });


  it("parses consume inventory text", async () => {
    const result =
      await parser.parse(
        "계란 2개 먹었어",
        workspaceId,
      );

    expect(result.intent)
      .toBe("consume_inventory");

    expect(result.items[0])
      .toMatchObject({
        rawName: "계란",
        quantity: 2,
        unit: "개",
      });

    expect(result.requiresClarification)
      .toBe(false);
  });


  it("requires clarification for unsupported text", async () => {
    const result =
      await parser.parse(
        "오늘 날씨 좋아",
        workspaceId,
      );

    expect(result.intent)
      .toBe(null);

    expect(result.requiresClarification)
      .toBe(true);

    expect(result.unsupportedReason)
      .toBe("unsupported_intent");
  });
});
