import type {
  ExecutedResult,
} from "../household-supplies/types.js";

import { InventoryTextParser } from "../household-supplies/parser/inventory-text-parser.js";

import type {
  ProductResolver,
} from "./product-resolver.js";

import type {
  UnitConversionResolver,
} from "./unit-conversion-resolver.js";

import {
  ResolveInventoryProposal,
} from "./resolve-inventory-proposal.js";

import type {
  ExecuteInventoryCommand,
} from "./execute-inventory-command.js";

export class ExecuteInventoryText {
  private readonly parser =
    new InventoryTextParser();

  private readonly resolver;

  constructor(
    private readonly productResolver: ProductResolver,
    private readonly unitConversionResolver: UnitConversionResolver,
    private readonly executeInventoryCommand: ExecuteInventoryCommand,
  ) {
    this.resolver =
      new ResolveInventoryProposal(
        productResolver,
        unitConversionResolver,
      );
  }

  async execute(
    input: {
      text: string;
      workspaceId: string;
      householdId: string;
      actorId: string;
    },
  ): Promise<ExecutedResult | null> {
    const proposal =
      this.parser.parse(
        input.text,
        input.workspaceId,
      );

    console.log("PARSER RESULT", proposal);

    const command =
      await this.resolver.execute(
        proposal,
        {
          householdId:
            input.householdId,
          actorId:
            input.actorId,
        },
      );

    if (!command) {
      console.log("RESOLVE FAILED", proposal);
      return null;
    }

    console.log("COMMAND RESULT", command);

    return this.executeInventoryCommand.execute(
      command,
    );
  }
}
