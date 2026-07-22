// Kernel — Event envelope. Pure types only; no storage concerns.

export type EventSource = "text" | "voice" | "receipt" | "ui" | "automation";

export type EventMetadata = {
  source?: EventSource;
  confidence?: number;
  rawInputRef?: string;
};

export type EventEnvelope<TPayload> = {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  householdId: string;
  workspaceId: string;
  actorId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  commandId: string;
  idempotencyKey: string;
  payload: TPayload;
  metadata?: EventMetadata;
};
