import { describe, expect, it } from "vitest";

import { InventoryQueryParser } from "../src/household-supplies/parser/inventory-query-parser.js";

const workspaceId =
  "22222222-2222-4222-8222-222222222222";

describe("InventoryQueryParser", () => {
  const parser =
    new InventoryQueryParser();

  it("parses inventory query text", () => {
    const result =
      parser.parse(
        "계란 몇 개 있어?",
        workspaceId,
      );

    expect(result)
      .toMatchObject({
        intent: "inventory_query",
        productName: "계란",
        requiresClarification: false,
      });
  });

  it("requires clarification for unsupported query", () => {
    const result =
      parser.parse(
        "오늘 뭐 먹지",
        workspaceId,
      );

    expect(result.intent)
      .toBe(null);
  });
});
