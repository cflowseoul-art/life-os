import type {
  ExecuteInventoryText,
} from "../execute-inventory-text.js";

import type {
  QueryInventoryText,
} from "../query-inventory-text.js";

import type {
  AnswerInventoryText,
} from "../answer-inventory-text.js";

export class InventoryCapability {
  constructor(
    private readonly executeInventoryText: ExecuteInventoryText,
    private readonly queryInventoryText: QueryInventoryText,
    private readonly answerInventoryText: AnswerInventoryText,
  ) {}

  executeText(
    input: Parameters<ExecuteInventoryText["execute"]>[0],
  ) {
    return this.executeInventoryText.execute(
      input,
    );
  }

  queryText(
    input: Parameters<QueryInventoryText["execute"]>[0],
  ) {
    return this.queryInventoryText.execute(
      input,
    );
  }

  answerText(
    input: Parameters<AnswerInventoryText["execute"]>[0],
  ) {
    return this.answerInventoryText.execute(
      input,
    );
  }

}


