import type {
  LlmClient,
} from "../../application/llm-client.js";

import type {
  InventoryCommandParser,
} from "./inventory-command-parser.js";

import {
  validateCommandProposal,
} from "../../application/command-proposal-validator.js";

import type {
  CommandProposal,
} from "../types.js";

export class LlmInventoryCommandParser
  implements InventoryCommandParser
{
  constructor(
    private readonly llmClient: LlmClient,
  ) {}

  async parse(
    text: string,
    workspaceId: string,
  ): Promise<CommandProposal> {
    const response =
      await this.llmClient.generate(
        text,
      );

    const parsed =
      JSON.parse(
        response,
      );

    this.normalizeFinalState(parsed);

    return validateCommandProposal(
      parsed,
      workspaceId,
    );
  }
  private normalizeFinalState(
    parsed: any,
  ): void {
    console.log(
      "[BEFORE_NORMALIZE]",
      JSON.stringify(parsed),
    );
    if (
      parsed.intent !== "consume_inventory" ||
      !Array.isArray(parsed.items)
    ) {
      return;
    }

    const allConsumed =
      parsed.items.some(
        (item: any) =>
          typeof item.rawName === "string" &&
          (
            item.rawName.includes("다") ||
            item.rawName.includes("전부")
          ) &&
          item.quantity === 1,
      );

    if (!allConsumed) {
      return;
    }

    console.log(
      "[NORMALIZE_TRIGGERED]",
      JSON.stringify(parsed),
    );

    parsed.intent = "adjust_inventory";

    parsed.items =
      parsed.items.map(
        (item: any) => ({
          ...item,
          rawName:
            item.rawName
              .replace(
                /(다|전부).*$/,
                "",
              )
              .trim(),
          quantity: 0,
          unit: "개",
        }),
      );
  }


}
