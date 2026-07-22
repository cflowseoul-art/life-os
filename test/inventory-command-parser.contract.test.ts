import { describe, expect, it } from "vitest";

import type {
  InventoryCommandParser,
} from "../src/household-supplies/parser/inventory-command-parser.js";

import {
  inventoryCommandParserCases,
} from "./fixtures/inventory-command-parser-cases.js";

export function inventoryCommandParserContract(
  createParser: () => InventoryCommandParser,
) {
  describe("InventoryCommandParser contract", () => {
    for (const testCase of inventoryCommandParserCases) {
      it(testCase.name, async () => {
        const parser = createParser();

        const result =
          await parser.parse(
            testCase.input,
            "workspace-001",
          );

        expect(result)
          .toMatchObject(
            testCase.expected,
          );
      });
    }
  });
}
