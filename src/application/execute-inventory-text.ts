import type {
  ExecutedResult,
} from "../household-supplies/types.js";

import type { InventoryCommandParser } from "../household-supplies/parser/inventory-command-parser.js";

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

type ExecuteTextResult =
  | {
      status: "executed";
      result: ExecutedResult;
    }
  | {
      status: "failed";
      proposal?: unknown;
      reason: string;
    }
  | {
      status: "not_command";
    };

export class ExecuteInventoryText {
  private readonly resolver;

  constructor(
    private readonly parser: InventoryCommandParser,
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
  ): Promise<ExecuteTextResult> {
    let proposal;

    try {
      proposal =
        await this.parser.parse(
          input.text,
          input.workspaceId,
        );
    } catch (error) {
      console.log(
        "COMMAND PARSE FAILED",
        error,
      );
      return {
        status: "not_command",
      };
    }

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

      return {
        status: "failed",
        proposal,
        reason: "resolve_failed",
      };
    }

    console.log("COMMAND RESULT", command);

    return {
      status: "executed",
      result:
        await this.executeInventoryCommand.execute(
          command,
        ),
    };
  }
}
