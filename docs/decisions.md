# Architecture Decision Log

Record durable decisions here. Keep entries concise.

## ADR-001 — Layered architecture

**Decision:** Separate Kernel, Application, Infrastructure, and Plugins.

**Reason:** Stable domain concepts must remain independent from replaceable technologies and expanding household capabilities.

## ADR-002 — Event-oriented state changes

**Decision:** Persist auditable domain changes as immutable events and maintain query projections.

**Reason:** Life OS needs history, undo, automation triggers, provenance, and confidence-aware AI answers.

**Caveat:** Do not event-source static or low-value configuration merely for purity.

## ADR-003 — AI as proposal generator

**Decision:** AI produces typed command proposals but cannot write directly to storage.

**Reason:** Authorization, validation, deterministic rules, and auditability must remain server-controlled.

## ADR-004 — Internal modular plugins first

**Decision:** Plugins begin as bounded modules inside one codebase.

**Reason:** Dynamic plugin loading and a marketplace would add complexity before there is a real requirement.

## ADR-005 — PostgreSQL-compatible first implementation

**Decision:** Prefer a PostgreSQL-compatible storage adapter for the first implementation while keeping domain ports provider-neutral.

**Reason:** Relational storage can support events, projections, permissions, relations, full-text search, and vectors without premature infrastructure sprawl.

## ADR-006 — Synchronous projection consistency (MVP)

**Decision:** For the MVP, projections are updated synchronously in the same
PostgreSQL transaction as the event append.

**Reason:** Read-your-writes with no eventual-consistency window, and no
distributed-systems machinery for two users.

**Caveat:** Asynchronous projectors may be introduced later behind the same
interface if a real throughput requirement appears. Projections must remain fully
rebuildable from event history at all times.

## ADR-007 — Event-sourced vs CRUD entities

**Decision:** Event sourcing applies only to Inventory, Shopping, Finance
transactions, and meaningful household activity history. Identity, Household,
Workspace, Membership, Product Catalog, aliases, and automation configuration use
normal CRUD with audit fields.

**Reason:** Event source only where auditability, undo, automation triggers, and
historical reasoning add real value; avoid event-sourcing static configuration
for purity.

## ADR-008 — Command idempotency

**Decision:** Every command carries both `commandId` and `idempotencyKey`.
Re-submitting the same `idempotencyKey` must not append a second event; the
server returns the original result.

**Reason:** Retries, flaky mobile networks, and repeated voice sends must not
double-apply state changes.

## ADR-009 — AI confidence and action policy

**Decision:** The server decides auto-execute vs confirm vs clarify from four
inputs — confidence, reversibility, blast radius, and financial sensitivity —
using the priority-ordered decision matrix in `03-ai-contract.md`.

**Reason:** Authorization and destructive/financial safety are server-controlled,
not delegated to model confidence alone. Thresholds are tunable configuration.

## ADR-010 — Permission model (MVP)

**Decision:** A small fixed model, not enterprise RBAC. Wife and husband share
one household; shared assets and household supplies are visible and editable by
both; every record and event retains actor ownership and attribution;
administrative actions are limited to the admin role (wife). Private personal
workspaces are a future capability.

**Reason:** Two trusted users need scoping and attribution, not a general-purpose
role/permission engine.

## ADR-011 — AI parsing evaluation strategy

**Decision:** AI parsing is validated against a Korean golden dataset and a
regression harness before it is trusted in the flow. The harness runs
independently of the database.

**Reason:** Korean intent/entity/quantity/unit extraction and canonical
normalization are the highest-risk components; their quality must be measured and
regression-guarded separately from persistence.

## ADR-012 — Receipt workflow orchestration

**Decision:** Cross-plugin workflows such as receipt confirmation are
orchestrated by the Application layer. Plugins react through typed events and
contracts and never call each other directly.

**Reason:** The receipt flow spans Household Supplies and Finance; the
coordination needs a single owner without coupling plugins.

## ADR-013 — Raw input storage and retention

**Decision:** Raw receipt images and future audio are stored in an
`ObjectStorage` infrastructure port and referenced from event metadata via
`rawInputRef`, under a documented retention policy.

**Reason:** Raw inputs are sensitive household data; they belong in a replaceable
object store with explicit retention, not inline in events or the relational
store.

## ADR-014 — Household Supplies plugin grouping (MVP)

**Decision:** Inventory and Shopping remain distinct domain capabilities but
initially live inside one Household Supplies plugin.

**Reason:** They share canonical products, normalization, and the receipt
workflow. Split into separate plugins only when a real requirement forces the
boundary.

## ADR-015 — Knowledge scope (MVP)

**Decision:** For the MVP, Knowledge is limited to canonical products, aliases
and synonyms, units and conversions, categories, and normalization rules, stored
as CRUD reference data.

**Reason:** Keeps the "meaning" layer concrete and useful without introducing a
graph database or open-ended ontology.

## ADR-016 — Automation MVP (hardcoded rules)

**Decision:** Automation remains an architectural capability, but the MVP
contains only explicit hardcoded rules such as low-stock shopping suggestions. Do
not build a generic rule engine.

**Reason:** One useful rule proves the capability; a general trigger/condition/
action engine is premature.

## ADR-017 — Idempotency uniqueness scope

**Decision:** The client generates a UUID `idempotencyKey` when a new user
submission is created; network retries reuse it and a new intentional submission
uses a new key. The server enforces uniqueness on `(workspaceId, idempotencyKey)`.
`commandId` remains unique per attempt for tracing.

**Reason:** Deduplication must be scoped to the workspace that owns the state,
and the client is the only place that knows whether a send is a retry or a new
intent. Refines ADR-008.

## ADR-018 — Undo deferral (MVP)

**Decision:** Undo is deferred out of the first slice. When implemented, its MVP
scope is limited to the most recent reversible command in the active session,
executed as a compensating event (never history deletion).

**Reason:** The compensating-event model is already established; a full undo
history and cross-session undo are not needed to prove the architecture.
