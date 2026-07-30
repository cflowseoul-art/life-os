import { describe, it, expect, vi } from "vitest";

import { InventoryCommandParserRouter } from "./inventory-command-parser-router.js";

describe("InventoryCommandParserRouter", () => {
  it("마지막 영수증 취소는 LLM fallback 하지 않는다", async () => {
    const ruleParser = {
      parse: vi.fn().mockResolvedValue({
        intent: "revert_last_receipt",
        targetPlugin: "household-supplies",
        workspaceId: "test-workspace",
        items: [],
        confidence: 1,
        requiresClarification: true,
      }),
    };

    const llmParser = {
      parse: vi.fn(),
    };

    const router =
      new InventoryCommandParserRouter(
        ruleParser,
        llmParser,
      );

    const result =
      await router.parse(
        "마지막 영수증 취소해줘",
        "test-workspace",
      );

    expect(result.intent)
      .toBe("revert_last_receipt");

    expect(llmParser.parse)
      .not
      .toHaveBeenCalled();
  });

  it("냉장고 비우기는 LLM fallback 하지 않는다", async () => {
    const ruleParser = {
      parse: vi.fn().mockResolvedValue({
        intent: "clear_inventory",
        targetPlugin: "household-supplies",
        workspaceId: "test-workspace",
        items: [],
        confidence: 1,
        requiresClarification: true,
      }),
    };

    const llmParser = {
      parse: vi.fn(),
    };

    const router =
      new InventoryCommandParserRouter(
        ruleParser,
        llmParser,
      );

    const result =
      await router.parse(
        "냉장고 비워줘",
        "test-workspace",
      );

    expect(result.intent)
      .toBe("clear_inventory");

    expect(llmParser.parse)
      .not
      .toHaveBeenCalled();
  });

});
