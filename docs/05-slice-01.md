# Slice 01 — Minimal Executable Architecture Proof

The narrowest end-to-end slice that proves the core pipeline:
Korean text → typed proposal → action policy → validation →
event append + projection update in one PostgreSQL transaction → query →
rebuild-equality.

Everything outside this file's scope is explicitly deferred (see "Excluded").

## Scope

In:
- Seeded local user, household, membership, shared workspace (no auth).
- Two intents only: purchase and consume household supplies.
- Korean parsing → typed command proposal.
- Action-policy evaluation, command validation.
- Event append + `inventory_items` projection update in one transaction.
- Idempotency (client UUID; unique per `workspaceId + idempotencyKey`).
- Query current inventory.
- Rebuild projection from events and assert equality.

Excluded: Google auth, invitations, receipt/OCR, voice, Finance, low-stock
automation, Undo, generic workflow/rule engines, async projection, vector DB,
UI beyond a minimal CLI.

## Assumptions / stack

- Node.js + TypeScript + PostgreSQL (per ADR-005; envelope already typed in TS).
- The parser in this slice is a **deterministic rule-based implementation behind
  a `ParserPort`**. It is sufficient for the two intents and the golden set, and
  keeps the slice runnable offline. An AI-backed implementation is a later swap
  behind the same port — no pipeline change.
- Minimal interface is a CLI that feeds one utterance through the pipeline and
  prints inventory. No web framework.

---

## 1. Acceptance criteria

1. Seed produces exactly one household, two users (wife=admin, husband=member),
   two memberships, one shared workspace, and knowledge rows (계란, 우유, alias
   특란→계란, unit conversion 판=30 개).
2. "계란 한 판하고 우유 두 개 샀어" parses to `purchase_inventory` with items
   `[{계란, 30, 개}, {우유, 2, 개}]` (판 normalized to 30 개, both canonicalized).
3. "계란 두 개 먹었어" parses to `consume_inventory` with `[{계란, 2, 개}]`.
4. Running purchase then consume yields projection: 계란 = 28 개, 우유 = 2 개.
5. Each command writes its event(s) and the projection update inside **one**
   transaction; a forced failure after append leaves neither events nor
   projection change committed.
6. Re-submitting a command with the same `workspaceId + idempotencyKey` appends
   no new event and returns the original response; a new `idempotencyKey`
   appends new events.
7. Querying inventory returns current quantity, unit, and freshness fields.
8. Rebuilding `inventory_items` from `inventory_events` produces a state
   deep-equal to the live projection.
9. Every event and command carries `actorId`; the actor is retrievable.
10. Unsupported/ambiguous inputs (e.g. "김치찌개 먹었어", "계란 좀 먹었어")
    produce a clarify result with **no** state change.
11. Golden-set parser test runs with no database and reports per-category
    accuracy.

## 2. Module and file structure

```text
src/
  kernel/
    event/envelope.ts          # EventEnvelope<T> (existing shape)
    identity/types.ts          # User, Household, Membership, Workspace, Actor
  application/
    ports.ts                   # ParserPort, EventStore, ProjectionStore,
                               #   IdempotencyStore, UnitOfWork, Clock
    action-policy.ts           # decide(proposal) -> Action
    command-bus.ts             # execute(command) -> Result (txn boundary)
  plugins/household-supplies/
    intents.ts                 # IntentName, CommandProposal, ProposedItem
    commands.ts                # PurchaseInventory/ConsumeInventory + validate()
    events.ts                  # InventoryPurchased/InventoryConsumed payloads
    reducer.ts                 # applyEvent(state, event) -> state  (pure)
    projection.ts              # InventoryItem shape, upsert + rebuild
    knowledge.ts               # KnowledgeSnapshot loader (CRUD reference)
    to-command.ts              # proposal -> typed command
    parser/
      parser-port.ts           # ParserPort interface + ParseContext
      rule-parser.ts           # deterministic parser for the two intents
  infrastructure/postgres/
    schema.sql                 # DDL (see sections 4-5)
    event-store.pg.ts
    projection-store.pg.ts
    idempotency-store.pg.ts
    unit-of-work.pg.ts         # begin/commit/rollback wrapper
  infrastructure/seed/
    seed.ts                    # identity + knowledge fixtures
  interface/
    cli.ts                     # read utterance -> pipeline -> print inventory
test/
  golden/dataset.jsonl
  parser.golden.test.ts
  pipeline.e2e.test.ts
  idempotency.test.ts
  rebuild.test.ts
  action-policy.test.ts
  validation.test.ts
```

No abstraction is introduced beyond ports that have an immediate second use
(the deterministic parser now vs AI parser later; the PG adapters vs an
in-memory test adapter).

## 3. Domain types

```ts
type IntentName = "purchase_inventory" | "consume_inventory";

type ProposedItem = {
  rawName: string;
  canonicalProductId: string | null;   // null => unresolved
  canonicalName: string | null;
  quantity: number;                     // already converted to base unit
  unit: string;                         // base unit (e.g. "개")
};

type CommandProposal = {
  intent: IntentName | null;            // null => unsupported
  targetPlugin: "household-supplies";
  workspaceId: string;
  items: ProposedItem[];
  confidence: number;                   // 0..1
  requiresClarification: boolean;
  unsupportedReason?: string;
};

type Actor = { userId: string; householdId: string };
```

## 4. Command and event schemas

```ts
// Commands
type InventoryLine = {
  canonicalProductId: string;
  canonicalName: string;
  quantity: number;                     // base unit, > 0
  unit: string;
  rawName: string;
};

type PurchaseInventoryCommand = {
  type: "PurchaseInventory";
  commandId: string;                    // UUID, this instance
  idempotencyKey: string;               // client UUID, retries reuse
  correlationId: string;
  householdId: string;
  workspaceId: string;
  actorId: string;
  items: InventoryLine[];
};

type ConsumeInventoryCommand = Omit<PurchaseInventoryCommand, "type"> & {
  type: "ConsumeInventory";
};

// Event payloads (one event per product line; aggregate = canonical product)
type InventoryPurchasedPayload = InventoryLine;
type InventoryConsumedPayload  = InventoryLine;
```

Events reuse the existing `EventEnvelope<T>` from `02-event-model.md`, with
`eventType` ∈ {`InventoryPurchased`, `InventoryConsumed`}, `aggregateType =
"inventory_item"`, `aggregateId = canonicalProductId`, and
`metadata.source = "text"`.

```sql
CREATE TABLE inventory_events (
  seq             BIGSERIAL PRIMARY KEY,     -- replay order, authoritative
  event_id        UUID NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  event_version   INT  NOT NULL DEFAULT 1,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    UUID NOT NULL,             -- canonicalProductId
  household_id    UUID NOT NULL,
  workspace_id    UUID NOT NULL,
  actor_id        UUID NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  correlation_id  UUID NOT NULL,
  causation_id    UUID,
  command_id      UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload         JSONB NOT NULL,
  metadata        JSONB
);
CREATE INDEX ON inventory_events (workspace_id, seq);
```

## 5. Projection schema

```sql
CREATE TABLE inventory_items (
  workspace_id        UUID NOT NULL,
  canonical_product_id UUID NOT NULL,
  canonical_name      TEXT NOT NULL,
  quantity            NUMERIC NOT NULL,
  unit                TEXT NOT NULL,
  last_verified_at    TIMESTAMPTZ NOT NULL,
  source_type         TEXT NOT NULL,   -- explicit_text (only value this slice)
  value_type          TEXT NOT NULL,   -- explicit_quantity (only value)
  freshness_status    TEXT NOT NULL,   -- fresh (derived; trivial this slice)
  last_seq            BIGINT NOT NULL, -- last applied event seq
  updated_at          TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, canonical_product_id)
);
```

`reducer.applyEvent(state, event)` is a pure fold shared by the live path and
rebuild — this guarantees rebuild equality by construction:

- `InventoryPurchased`: `quantity += payload.quantity`
- `InventoryConsumed`:  `quantity -= payload.quantity`
- both set `last_verified_at = occurred_at`, `source_type = explicit_text`,
  `value_type = explicit_quantity`, `freshness_status = fresh`,
  `last_seq = event.seq`.

Stock-availability guarding (blocking a consume below zero) is **out of scope**;
arithmetic is plain so live and rebuild agree.

## 6. Transaction boundary

One `UnitOfWork` transaction per command:

```text
BEGIN
  INSERT INTO processed_commands (workspace_id, idempotency_key, command_id)
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
    RETURNING 1;
  IF no row returned:                 -- duplicate submission
    SELECT response FROM processed_commands
      WHERE workspace_id=? AND idempotency_key=?;
    ROLLBACK; RETURN stored response;
  append event(s) -> inventory_events (seq assigned)
  apply each event via reducer -> UPSERT inventory_items
  UPDATE processed_commands SET response=? WHERE (workspace_id, idempotency_key)
COMMIT
```

Events + projection + idempotency record commit atomically. A failure anywhere
rolls back all three.

## 7. Idempotency behavior

```sql
CREATE TABLE processed_commands (
  workspace_id    UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_id      UUID NOT NULL,
  response        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, idempotency_key)
);
```

- The **client** generates a UUID `idempotencyKey` when a new user submission is
  created.
- Network retries reuse the same `idempotencyKey` → no new event, original
  response returned.
- A new intentional submission uses a new `idempotencyKey`.
- Uniqueness is enforced by the primary key `(workspace_id, idempotency_key)`
  (ADR-017). `commandId` remains unique per attempt for tracing.

## 8. Parser interface

```ts
type KnowledgeSnapshot = {
  products: { id: string; canonicalName: string; baseUnit: string }[];
  aliases:  { alias: string; canonicalProductId: string }[];
  unitConversions: {
    canonicalProductId: string; fromUnit: string; toBaseFactor: number;
  }[]; // e.g. 계란: 판 -> factor 30 -> 개
};

type ParseContext = {
  householdId: string;
  workspaceId: string;
  knowledge: KnowledgeSnapshot;
};

interface ParserPort {
  parse(input: string, ctx: ParseContext): Promise<CommandProposal>;
}
```

The rule parser: detect intent by verb (`샀어/삿어/구매` → purchase; `먹었어/
마셨어/썼어` → consume); extract `product + quantity + unit` groups; resolve
product via aliases/canonical names; convert unit to base via `unitConversions`;
set `confidence`; set `requiresClarification=true` (and `intent=null` /
`unsupportedReason`) for unknown verbs, unknown products, or missing quantity.

## 9. Golden-dataset format

`test/golden/dataset.jsonl`, one JSON object per line:

```json
{"id":"buy-01","category":"purchase","input":"계란 한 판하고 우유 두 개 샀어","expected":{"intent":"purchase_inventory","requiresClarification":false,"items":[{"canonicalName":"계란","quantity":30,"unit":"개"},{"canonicalName":"우유","quantity":2,"unit":"개"}]}}
{"id":"eat-01","category":"consume","input":"계란 두 개 먹었어","expected":{"intent":"consume_inventory","requiresClarification":false,"items":[{"canonicalName":"계란","quantity":2,"unit":"개"}]}}
{"id":"alias-01","category":"alias","input":"특란 서른 개 샀어","expected":{"intent":"purchase_inventory","requiresClarification":false,"items":[{"canonicalName":"계란","quantity":30,"unit":"개"}]}}
{"id":"ambig-01","category":"ambiguity","input":"계란 좀 먹었어","expected":{"intent":"consume_inventory","requiresClarification":true,"items":[]}}
{"id":"unsup-01","category":"unsupported","input":"김치찌개 먹었어","expected":{"intent":null,"requiresClarification":true,"items":[]}}
```

Categories to cover (30–50 lines): purchase, consumption, aliases, units,
multiple products, ambiguity, unsupported. Thresholds provisional until measured
(ADR-011).

## 10. Test plan

1. `parser.golden` — run parser over dataset (no DB); assert intent +
   normalized items; report per-category accuracy.
2. `action-policy` — matrix cases: high/med confidence reversible non-financial →
   execute; low confidence / requiresClarification → clarify.
3. `validation` — reject unknown product, non-positive quantity, empty items.
4. `pipeline.e2e` — seed → purchase → consume → query; assert 계란=28, 우유=2,
   and actor attribution on events.
5. `idempotency` — same key twice → 1 event set + identical response; new key →
   additional events.
6. `rebuild` — rebuild from `inventory_events`; deep-equal with live projection.
7. Transaction atomicity — inject failure after append; assert no committed
   events or projection change.

## 11. Implementation order

1. Postgres `schema.sql` + local DB bring-up; `UnitOfWork`.
2. Kernel types (`envelope.ts`, identity types).
3. Knowledge CRUD tables + `seed.ts` (identity + 계란/우유/alias/판=30개).
4. `ParserPort` + `rule-parser` + `dataset.jsonl` + `parser.golden` test —
   prove parsing before wiring persistence.
5. Domain: proposal/command/event types, `validate()`, pure `reducer`.
6. PG adapters: event store, projection store, idempotency store.
7. Application: `action-policy` + `command-bus` (transaction boundary).
8. `cli.ts` minimal interface.
9. e2e, idempotency, rebuild, atomicity tests.

## 12. Issues that still block coding

- **Stack confirmation** — Node+TS+pg assumed; confirm before scaffolding.
- **Local Postgres** — need a chosen local run method (Docker vs local install)
  and test DB lifecycle (per-test schema/truncate).
- **Parser choice for this slice** — confirmed deterministic rule parser (not
  live AI). If a live AI parser is wanted now, add provider config + cost/latency
  handling; the port is unchanged either way.
- **Consume-below-zero policy** — currently allowed (plumbing proof). Confirm
  this is acceptable for the slice or add a stock guard (adds a domain rule).

---

## Temporary MVP decisions recorded here

**Shared household permissions** (refines ADR-010): both members may view and
change shared household-supply records; every command and event retains actor
attribution; a correction by another member retains both the original actor and
the correcting actor; no enterprise RBAC.

**Idempotency** (ADR-017): client-generated UUID; retries reuse it; a new
intentional submission uses a new key; uniqueness enforced by
`workspaceId + idempotencyKey`.

**Undo** (ADR-018): deferred. Future MVP scope limits it to the most recent
reversible command in the active session via a compensating event.

**Golden dataset**: start with 30–50 manually authored Korean utterances across
purchase, consumption, aliases, units, multiple products, ambiguity, and
unsupported requests; thresholds provisional until measured.
