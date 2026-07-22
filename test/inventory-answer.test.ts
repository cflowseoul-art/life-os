import { describe, expect, it } from "vitest";

import {
  InventoryAnswerGenerator,
} from "../src/application/inventory-answer.js";

describe("InventoryAnswerGenerator", () => {
  const generator =
    new InventoryAnswerGenerator();

  it("generates answer for single inventory item", () => {
    const result =
      generator.generate([
        {
          workspaceId: "workspace-1",
          canonicalProductId: "product-1",
          canonicalName: "계란",
          quantity: 57,
          unit: "개",
          lastVerifiedAt:
            "2026-07-22T00:00:00.000Z",
          sourceType: "explicit_text",
          valueType: "explicit_quantity",
          freshnessStatus: "fresh",
          lastSeq: 1,
        },
      ]);

    expect(result.message)
      .toBe("계란 57개 있어요.");

    expect(result.items)
      .toHaveLength(1);
  });


  it("generates empty inventory answer", () => {
    const result =
      generator.generate([]);

    expect(result.message)
      .toBe("확인되는 재고가 없어요.");
  });
});
