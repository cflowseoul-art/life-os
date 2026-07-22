import { describe, expect, it } from "vitest";

import { InventoryCommandParserRouter } from "../src/household-supplies/parser/inventory-command-parser-router.js";

import type {
  InventoryCommandParser,
} from "../src/household-supplies/parser/inventory-command-parser.js";


class FakeParser
  implements InventoryCommandParser
{
  public called = false;

  constructor(
    private readonly result: any,
  ) {}

  async parse(
    _text: string,
    _workspaceId: string,
  ) {
    this.called = true;

    return this.result;
  }
}


describe(
  "InventoryCommandParserRouter",
  () => {

    it(
      "uses rule parser when rule succeeds",
      async () => {
        const rule =
          new FakeParser({
            intent:
              "purchase_inventory",
            items: [
              {
                rawName:
                  "계란",
                quantity:1,
                unit:"판",
              },
            ],
            confidence:0.8,
            requiresClarification:false,
          });

        const llm =
          new FakeParser({
            intent:
              "purchase_inventory",
            items:[],
            confidence:1,
            requiresClarification:false,
          });

        const router =
          new InventoryCommandParserRouter(
            rule,
            llm,
          );

        await router.parse(
          "계란 한 판 샀어",
          "workspace-1",
        );

        expect(rule.called)
          .toBe(true);

        expect(llm.called)
          .toBe(false);
      },
    );


    it(
      "falls back to llm when rule fails",
      async () => {
        const rule =
          new FakeParser({
            intent:null,
            items:[],
            confidence:0,
            requiresClarification:true,
          });

        const llm =
          new FakeParser({
            intent:
              "purchase_inventory",
            items:[],
            confidence:1,
            requiresClarification:false,
          });

        const router =
          new InventoryCommandParserRouter(
            rule,
            llm,
          );

        await router.parse(
          "마트에서 특란 사왔어",
          "workspace-1",
        );

        expect(rule.called)
          .toBe(true);

        expect(llm.called)
          .toBe(true);
      },
    );

  },
);
