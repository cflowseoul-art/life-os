// Household Supplies — domain types for Slice 01.
// Pure types only. No parser, events pipeline, projection, or persistence here.

import type { EventEnvelope } from "../kernel/event.js";

export type IntentName = "purchase_inventory" | "consume_inventory";

// Output of the parser: a proposal, never a state change (ADR-003).
export type ProposedItem = {
  rawName: string;
  canonicalProductId: string | null; // null => unresolved product
  canonicalName: string | null;
  quantity: number; // already converted to the product's base unit
  unit: string;
};

export type ClarificationReason =
  | "unsupported_intent"
  | "unknown_product"
  | "ambiguous_quantity"
  | "insufficient_recorded_stock";

export type CommandProposal = {
  intent: IntentName | null; // null => unsupported input
  targetPlugin: "household-supplies";
  workspaceId: string;
  items: ProposedItem[];
  confidence: number; // 0..1
  requiresClarification: boolean;
  unsupportedReason?: ClarificationReason;
};

// A validated, executable inventory line (base unit, positive quantity).
export type InventoryLine = {
  canonicalProductId: string;
  canonicalName: string;
  quantity: number;
  unit: string;
  rawName: string;
};

type CommandBase = {
  commandId: string; // unique per attempt
  idempotencyKey: string; // client UUID; retries reuse (ADR-017)
  correlationId: string;
  householdId: string;
  workspaceId: string;
  actorId: string;
  items: InventoryLine[];
};

export type PurchaseInventoryCommand = CommandBase & { type: "PurchaseInventory" };
export type ConsumeInventoryCommand = CommandBase & { type: "ConsumeInventory" };
export type InventoryCommand = PurchaseInventoryCommand | ConsumeInventoryCommand;

// One event per submission; the payload carries all product lines
// (event-granularity correction to the Slice 01 design).
export type InventoryEventType = "InventoryPurchased" | "InventoryConsumed";
export type InventoryEventPayload = { items: InventoryLine[] };
export type InventoryEvent = EventEnvelope<InventoryEventPayload>;

// Projection row shape (see 02-event-model.md freshness model).
export type InventoryItemState = {
  workspaceId: string;
  canonicalProductId: string;
  canonicalName: string;
  quantity: number;
  unit: string;
  lastVerifiedAt: string;
  sourceType: "explicit_text" | "receipt_confirmed" | "inferred_status" | "automation";
  valueType: "explicit_quantity" | "inferred_status";
  freshnessStatus: "fresh" | "stale" | "uncertain";
  lastSeq: number;
};

export type ExecutedResult = {
  status: "executed";
  intent: IntentName;
  eventId: string;
  items: InventoryLine[];
};

export type ClarificationResult = {
  status: "clarification_required";
  reason: ClarificationReason;
  details?: {
    canonicalName?: string;
    currentQuantity?: number;
    requestedQuantity?: number;
  };
};

export type CommandResult = ExecutedResult | ClarificationResult;
