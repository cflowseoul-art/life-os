import type {
  InventoryQueryParser,
} from "./inventory-query-parser.js";

import type {
  InventoryQueryProposal,
} from "../types.js";

export class InventoryQueryParserRouter
  implements InventoryQueryParser
{
  constructor(
    private readonly ruleParser: InventoryQueryParser,
    private readonly llmParser: InventoryQueryParser,
  ) {}

  async parse(
    text: string,
    workspaceId: string,
  ): Promise<InventoryQueryProposal> {
    const ruleResult =
      await this.ruleParser.parse(
        text,
        workspaceId,
      );

    if (
      ruleResult.intent !== null
    ) {
      console.log(
        "[QUERY_RULE_RESULT]",
        ruleResult,
      );

      return ruleResult;
    }

    return this.llmParser.parse(
      text,
      workspaceId,
    );
  }
}
