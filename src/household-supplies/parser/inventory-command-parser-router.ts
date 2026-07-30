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

    console.log("[RULE_RESULT]", ruleResult);

    if (
      ruleResult.intent === "revert_last_receipt" ||
      ruleResult.intent === "clear_inventory"
    ) {
      return ruleResult;
    }

    if (
      ruleResult.intent !== null &&
      ruleResult.items.length > 0 &&
      !ruleResult.requiresClarification &&
      this.isReliableRuleResult(ruleResult)
    ) {
      return ruleResult;
    }

    console.log("[ROUTER] FALLBACK_TO_LLM");

    const llmResult =
      await this.llmParser.parse(
        text,
        workspaceId,
      );

    console.log("[LLM_RESULT]", llmResult);

    return llmResult;
  }

  private isReliableRuleResult(
    result: CommandProposal,
  ): boolean {
    // Rule parser handles only simple single-item commands.
    if (
      result.items.length !== 1
    ) {
      return false;
    }

    const item =
      result.items[0];

    if (!item) {
      return false;
    }

    if (
      item.rawName.includes("이랑") ||
      item.rawName.includes("랑") ||
      item.rawName.includes("하고")
    ) {
      return false;
    }

    if (
      result.intent === "consume_inventory"
    ) {
      return (
        item.quantity > 0 &&
        !item.rawName.includes("다") &&
        !item.rawName.includes("전부")
      );
    }

    return true;
  }
}
