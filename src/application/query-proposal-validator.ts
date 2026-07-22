import { z } from "zod";

import type {
  InventoryQueryProposal,
} from "../household-supplies/types.js";

const queryProposalSchema =
  z.object({
    intent:
      z.enum([
        "inventory_query",
        "inventory_list",
      ])
      .nullable(),

    productName:
      z.string()
      .nullable(),

    confidence:
      z.number(),

    requiresClarification:
      z.boolean(),

    unsupportedReason:
      z.enum([
        "unsupported_intent",
        "unknown_product",
        "ambiguous_quantity",
        "insufficient_recorded_stock",
      ])
      .optional(),
  });


export function validateQueryProposal(
  input: unknown,
  workspaceId: string,
): InventoryQueryProposal {
  const parsed =
    queryProposalSchema.parse(
      input,
    );

  const {
    unsupportedReason,
    ...rest
  } = parsed;

  return {
    ...rest,
    ...(unsupportedReason !== undefined
      ? {
          unsupportedReason,
        }
      : {}),
    targetPlugin:
      "household-supplies",
    workspaceId,
  };
}
