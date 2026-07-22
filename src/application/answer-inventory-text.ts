import type {
  InventoryAnswer,
} from "./inventory-answer.js";

import {
  InventoryAnswerGenerator,
} from "./inventory-answer.js";

import type {
  QueryInventoryText,
} from "./query-inventory-text.js";

export class AnswerInventoryText {
  private readonly generator =
    new InventoryAnswerGenerator();

  constructor(
    private readonly queryInventoryText: QueryInventoryText,
  ) {}

  async execute(
    input: {
      text: string;
      workspaceId: string;
    },
  ): Promise<InventoryAnswer | null> {
    const items =
      await this.queryInventoryText.execute(
        input,
      );

    if (!items) {
      return null;
    }

    return this.generator.generate(
      items,
    );
  }
}
