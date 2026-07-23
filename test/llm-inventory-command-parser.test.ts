import { describe, expect, it } from "vitest";
import { LlmInventoryCommandParser } from "../src/household-supplies/parser/llm-inventory-command-parser.js";
import { inventoryCommandParserContract } from "./inventory-command-parser.contract.test.js";
import { FakeLlmClient } from "./fakes/fake-llm-client.js";

inventoryCommandParserContract(
  () =>
    new LlmInventoryCommandParser(
      new FakeLlmClient({
        "계란 한 판 샀어":
          JSON.stringify({
            intent: "purchase_inventory",
            items: [
              {
                rawName: "계란",
                quantity: 1,
                unit: "판",
              },
            ],
            confidence: 0.9,
            requiresClarification: false,
          }),

        "계란 2개 먹었어":
          JSON.stringify({
            intent: "consume_inventory",
            items: [
              {
                rawName: "계란",
                quantity: 2,
                unit: "개",
              },
            ],
            confidence: 0.9,
            requiresClarification: false,
          }),

        "계란 0개로 수정해줘":
          JSON.stringify({
            intent: "adjust_inventory",
            items: [
              {
                rawName: "계란",
                quantity: 0,
                unit: "개",
              },
            ],
            confidence: 0.9,
            requiresClarification: false,
          }),

        "오늘 날씨 좋아":
          JSON.stringify({
            intent: null,
            items: [],
            confidence: 0,
            requiresClarification: true,
            unsupportedReason:
              "unsupported_intent",
          }),
      }),
    ),
);


describe("LlmInventoryCommandParser validation", () => {
  it("rejects invalid LLM output", async () => {
    const parser =
      new LlmInventoryCommandParser(
        new FakeLlmClient({
          "잘못된 응답":
            JSON.stringify({
              intent: "purchase_inventory",
              items: "계란",
              confidence: 0.9,
              requiresClarification: false,
            }),
        }),
      );

    await expect(
      parser.parse(
        "잘못된 응답",
        "workspace-1",
      ),
    ).rejects.toThrow();
  });
});
