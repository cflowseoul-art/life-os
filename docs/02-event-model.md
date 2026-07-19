# Event Model

## Principle

State changes are represented as immutable domain events. Current state is exposed through projections.

```text
Command
→ authorization
→ validation
→ domain decision
→ event append
→ projection update
→ response
```

## Event envelope

Every event should include fields equivalent to:

```ts
type EventEnvelope<TPayload> = {
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
  payload: TPayload;
  metadata?: {
    source?: "text" | "voice" | "receipt" | "ui" | "automation";
    confidence?: number;
    rawInputRef?: string;
  };
};
```

## Correction

Never rewrite a past event to hide an error.

Example:

```text
InventoryConsumed(quantity=2)
InventoryConsumptionReverted(originalEventId=...)
```

## Projection

An event store is authoritative for history. A projection is optimized for queries.

Example:

```text
inventory_events
→ authoritative change history

inventory_items
→ current quantity/status/freshness projection
```

## Practical constraint

Use event-oriented architecture where auditability, undo, automation, and historical reasoning matter. Do not force every static configuration record into elaborate event sourcing without clear value.
