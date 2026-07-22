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

    return validateCommandProposal(
      parsed,
      workspaceId,
    );
  }
}
