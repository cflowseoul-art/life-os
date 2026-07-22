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
  ) {}

  async handle(
    input: AssistantInput,
  ): Promise<unknown> {
    return this.inventoryCapability.executeText({
      text: input.text,
      workspaceId: input.workspaceId,
      householdId: input.householdId,
      actorId: input.actorId,
    });
  }
}
