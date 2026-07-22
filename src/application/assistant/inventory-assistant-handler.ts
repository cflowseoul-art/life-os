import {
  InventoryQueryParser,
} from "../../household-supplies/parser/inventory-query-parser.js";

import type {
  InventoryCapability,
} from "../capabilities/inventory-capability.js";

import type {
  AssistantInput,
} from "./assistant-service.js";

export class InventoryAssistantHandler {
  private readonly queryParser =
    new InventoryQueryParser();

  constructor(
    private readonly inventoryCapability:
      InventoryCapability,
  ) {}

  async handle(
    input: AssistantInput,
  ): Promise<unknown> {
    const queryProposal =
      this.queryParser.parse(
        input.text,
        input.workspaceId,
      );

    if (
      queryProposal.intent !== null
    ) {
      return this.inventoryCapability.answerText({
        text: input.text,
        workspaceId: input.workspaceId,
      });
    }

    return this.inventoryCapability.executeText({
      text: input.text,
      workspaceId: input.workspaceId,
      householdId: input.householdId,
      actorId: input.actorId,
    });
  }
}
