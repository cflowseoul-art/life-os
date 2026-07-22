import { z } from "zod";

import type {
  CommandProposal,
} from "../household-supplies/types.js";

const proposedItemSchema =
  z.object({
    rawName: z.string(),
    quantity: z.number(),
    unit: z.string(),
  });

const commandProposalSchema =
  z.object({
    intent:
      z.enum([
        "purchase_inventory",
        "consume_inventory",
      ])
      .nullable(),

    items:
      z.array(
        proposedItemSchema,
      ),

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

export function validateCommandProposal(
  input: unknown,
  workspaceId: string,
): CommandProposal {
  const parsed =
    commandProposalSchema.parse(
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
