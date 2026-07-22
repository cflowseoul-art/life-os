# Event Model

## Principle

State changes are represented as immutable domain events. Current state is
exposed through projections.

```text
Command (commandId + idempotencyKey)
→ authorization
→ validation
→ domain decision
→ [ event append + projection update ]  (one PostgreSQL transaction)
→ response
```

## Event-sourced vs CRUD scope

Event sourcing is applied only where auditability, undo, automation triggers,
and historical reasoning add real value (ADR-007):

Event-sourced:
- Inventory
- Shopping
- Finance transactions
- Meaningful household activity history

CRUD (normal mutable rows with audit fields):
- Identity, Household, Workspace, Membership
- Product Catalog, aliases and synonyms
- Automation configuration

Do not force static or low-value configuration into event sourcing for purity.

## Command idempotency

Every command carries both:

- `commandId` — unique identifier for this command instance
- `idempotencyKey` — deduplication key for a logical user intent

Re-submitting the same `idempotencyKey` (retry, flaky mobile network, repeated
voice send) must not append a second event. The server records processed keys
and returns the original result. This prevents "계란 두 개 먹었어" sent twice from
double-consuming (ADR-008).

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
  commandId: string;
  idempotencyKey: string;
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

An event store is authoritative for history. A projection is optimized for
queries.

Example:

```text
inventory_events
→ authoritative change history

inventory_items
→ current quantity/status/freshness projection
```

### Synchronous consistency (MVP)

For the MVP, projections are updated **synchronously in the same PostgreSQL
transaction** as the event append (ADR-006). This gives read-your-writes with no
eventual-consistency window and avoids distributed-systems machinery that two
users do not need. Asynchronous projectors may be introduced later behind the
same interface if a real throughput requirement appears.

### Rebuild

Projections must remain **fully rebuildable from event history**. A projection
is a derived cache; deleting and replaying it from `*_events` must reproduce the
identical current state. This is a required MVP capability and a test target.

## Freshness model (MVP)

Current-state answers must distinguish a recently verified fact from a stale one.
The inventory projection carries, per item:

- `lastVerifiedAt` — timestamp of the most recent explicit confirmation
- `sourceType` — `explicit_text` | `receipt_confirmed` | `inferred_status` | `automation`
- `valueType` — `explicit_quantity` | `inferred_status`
- `freshnessStatus` — derived: `fresh` | `stale` | `uncertain`

Derivation rules (deliberately simple, single tunable threshold `N` = 14 days):

- `fresh` — an explicit quantity or confirmed receipt within the last `N` days,
  with no unaccounted consumption/purchase since.
- `stale` — last verification older than `N` days, or the newest signal is an old
  purchase with no recent confirmation.
- `uncertain` — the value rests only on an inferred status (`enough`/`low`/`out`),
  or signals conflict.

Only explicit events (`explicit_text`, `receipt_confirmed`) reset `lastVerifiedAt`
and can make an item `fresh`; an inferred status never restores `fresh`. Source
rank for tie-breaking: `explicit_text` ≈ `receipt_confirmed` > `inferred_status`.

Category-specific thresholds are deferred until proven necessary.

## Practical constraint

Use event-oriented architecture where auditability, undo, automation, and
historical reasoning matter. Do not force every static configuration record into
elaborate event sourcing without clear value.
