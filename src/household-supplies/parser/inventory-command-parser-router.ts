import type {
  InventoryCommandParser,
} from "./inventory-command-parser.js";

import type {
  CommandProposal,
} from "../types.js";


export class InventoryCommandParserRouter
  implements InventoryCommandParser
{
  constructor(
    private readonly ruleParser: InventoryCommandParser,
    private readonly llmParser: InventoryCommandParser,
  ) {}

  async parse(
    text: string,
    workspaceId: string,
  ): Promise<CommandProposal> {

    const ruleResult =
      await this.ruleParser.parse(
        text,
        workspaceId,
      );

    if (
      ruleResult.intent !== null &&
      ruleResult.items.length > 0 &&
      !ruleResult.requiresClarification
    ) {
      return ruleResult;
    }

    return this.llmParser.parse(
      text,
      workspaceId,
    );
  }
}
