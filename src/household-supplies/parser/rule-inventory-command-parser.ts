import type {
  CommandProposal,
  IntentName,
  ProposedItem,
} from "../types.js";

import type {
  InventoryCommandParser,
} from "./inventory-command-parser.js";

import { KoreanNumberNormalizer } from "./normalizers/korean-number-normalizer.js";

export class RuleInventoryCommandParser implements InventoryCommandParser {
  private readonly normalizer =
    new KoreanNumberNormalizer();

  async parse(
    text: string,
    workspaceId: string,
  ): Promise<CommandProposal> {
    const normalized =
      this.normalizer.normalize(text);

    const intent =
      this.detectIntent(normalized);

    const item =
      this.extractItem(normalized);

    const proposal: CommandProposal = {
      intent,
      targetPlugin: "household-supplies",
      workspaceId,
      items: item ? [item] : [],
      confidence: item ? 0.8 : 0,
      requiresClarification:
        intent === null || item === null,
    };

    if (intent === null) {
      proposal.unsupportedReason =
        "unsupported_intent";
    }

    return proposal;
  }

  private detectIntent(
    text: string,
  ): IntentName | null {
    if (
      /(샀|구매|사왔|구입)/.test(text)
    ) {
      return "purchase_inventory";
    }

    if (
      /(먹|사용|썼|소비)/.test(text)
    ) {
      return "consume_inventory";
    }

    return null;
  }

  private extractItem(
    text: string,
  ): ProposedItem | null {
    const quantityMatch =
      text.match(/(\d+)/);

    const quantity =
      quantityMatch
        ? Number(quantityMatch[1])
        : 1;

    let unit = "개";

    if (text.includes("판")) {
      unit = "판";
    }

    const name =
      text
        .replace(
          /(샀어|샀다|샀|구매했어|구매|사왔어|사왔|구입했어|구입|먹었어|먹|사용했어|사용|썼어|썼|소비했어|소비)/g,
          "",
        )
        .replace(
          /\d+/g,
          "",
        )
        .replace(
          /(개|판)/g,
          "",
        )
        .trim();

    if (!name) {
      return null;
    }

    return {
      rawName: name,
      quantity,
      unit,
    };
  }
}

export {
  RuleInventoryCommandParser as InventoryTextParser,
};
