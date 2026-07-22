import type {
  InventoryQueryParser,
} from "../../household-supplies/parser/inventory-query-parser.js";

import type {
  InventoryCapability,
} from "../capabilities/inventory-capability.js";

import type {
  AssistantInput,
} from "./assistant-service.js";


export class InventoryAssistantHandler {
  constructor(
    private readonly inventoryCapability:
      InventoryCapability,
    private readonly queryParser:
      InventoryQueryParser,
  ) {}

  async handle(
    input: AssistantInput,
  ): Promise<unknown> {
    const queryProposal =
      await this.queryParser.parse(
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
