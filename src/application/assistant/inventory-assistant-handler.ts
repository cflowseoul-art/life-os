import type {
  InventoryQueryParser,
} from "../../household-supplies/parser/inventory-query-parser.js";

import type {
  InventoryCommandParser,
} from "../../household-supplies/parser/inventory-command-parser.js";

import type {
  InventoryCapability,
} from "../capabilities/inventory-capability.js";

import type {
  AssistantInput,
} from "./assistant-service.js";

import type {
  AssistantInteractionStore,
} from "../assistant-interaction-store.js";


export class InventoryAssistantHandler {
  constructor(
    private readonly inventoryCapability:
      InventoryCapability,

    private readonly queryParser:
      InventoryQueryParser,

    private readonly commandParser:
      InventoryCommandParser,

    private readonly interactionStore:
      AssistantInteractionStore,
  ) {}


  async handle(
    input: AssistantInput,
  ): Promise<unknown> {

    const startedAt = Date.now();

    console.log(
      "[ASSISTANT_INPUT]",
      input.text,
    );


    const commandResult =
      await this.inventoryCapability.executeText({
        text:
          input.text,

        workspaceId:
          input.workspaceId,

        householdId:
          input.householdId,

        actorId:
          input.actorId,
      });


    console.log(
      "[COMMAND_RESULT]",
      commandResult,
    );


    if (
      commandResult.status === "executed"
    ) {
      const result =
        commandResult.result;

      const itemText =
        result.items
          .map(
            (item) =>
              `${item.canonicalName} ${item.quantity}${item.unit}`,
          )
          .join(", ");

      const message =
        result.intent === "purchase_inventory"
          ? `${itemText} 추가했어요.`
          : result.intent === "consume_inventory"
            ? `${itemText} 사용했어요.`
            : result.intent === "adjust_inventory"
              ? `${itemText}로 수정했어요.`
              : "재고를 변경했어요.";

      await this.interactionStore.save({
        workspaceId: input.workspaceId,
        inputText: input.text,
        intent: result.intent,
        commandType: result.intent,
        success: true,
        responseTimeMs:
          Date.now() - startedAt,
      });

      return {
        message,
        result,
      };
    }
    const queryProposal =
      await this.queryParser.parse(
        input.text,
        input.workspaceId,
      );


    console.log(
      "[QUERY_PROPOSAL]",
      queryProposal,
    );


    return this.inventoryCapability.answerText({
      text:
        input.text,

      workspaceId:
        input.workspaceId,
    });
  }
}
