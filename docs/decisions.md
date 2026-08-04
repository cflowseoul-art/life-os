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

## ADR-019 — Prototypes live outside the architecture

**Decision:** Non-production experiments live in a top-level `prototypes/`
directory, outside Kernel, Application, Infrastructure, and Plugins. They contain
no TypeScript, no schema, no routes, and no plugin registration, and are excluded
from `tsconfig.json` (`include: ["src","test"]`) and `vitest.config.ts`. The first
is `prototypes/resume-tailoring/` — a Markdown-only Claude Code workflow for
JD-tailored resumes.

**Reason:** `04-mvp.md` defers Resume until the Household Supplies slice is
proven, and that deferral stands. A prototype that produces no production
artifact is requirements discovery, not implementation — it can inform a future
Resume Plugin's source-data schema, evidence traceability, and fact-check gate
without committing the architecture to any of them.

**Caveat:** `prototypes/` is not a fifth layer. Nothing in it may be lifted into
`src/` as-is: it has no `householdId`, `workspaceId`, or `actorId`, it uses the
filesystem as its store, and the AI writes its outputs directly — all of which
violate `CLAUDE.md` rules that bind real commands and events. Promotion requires
a normal plugin design.

## ADR-020 — Office Engine as a frontend projection/renderer

**Decision:** The Office Engine is a frontend projection and renderer capability
that depicts activity. It consumes application-facing contracts only; Kernel,
Application, Infrastructure, and plugins never depend on it. Its office state is
a derived, disposable projection with no write path into Life OS. Every inbound
fact and outbound intent carries `householdId`, `workspaceId`, `actorId`, and the
event position/version it was projected from; ordering is by position, not
timestamp. One office state per workspace, never merged. Outbound intent is a
proposal the server validates, subject to ADR-003 and ADR-009.

**Reason:** A visualization must not become a second source of truth. Confining it
to contracts and proposals keeps ADR-001's dependency direction intact and lets the
engine be removed without changing domain behavior.

**Caveat:** An engine snapshot is a read-model snapshot, authoritative inside the
engine only — never history, which remains the event log under ADR-002. Ambient
readings carry freshness and confidence so a depiction cannot imply certainty the
projection does not have.

## ADR-021 — Department-owned fact vocabulary

**Decision:** A `KnowledgeFact` carries a `type` and a `value` owned by the
department that wrote them. The kernel stores and transports both and never
inspects either. Each department declares its own discriminated union over the
fact type and narrows on read. There is no global domain enum in the kernel.

**Reason:** A shared vocabulary in the kernel makes the kernel know Career, Home,
and Finance, which is the coupling ADR-001's dependency direction forbids.
Adding a department fact type must change that department's own module and
nothing else.

**Caveat:** Because the kernel transports the value opaquely, a department must
validate shape on read. That re-validation is required regardless — events are
persisted as JSON and re-read — so it is a property of durability, not overhead.

## ADR-022 — Actor, author, and source are three concepts

**Decision:** `actor` (on the event envelope) is who caused the event to be
written. `author` (on the fact) is who asserts the fact is true. `source` (on the
fact) is where the evidence came from. All three are recorded and none may be
derived from another. An author that is not known is recorded as `unattributed`.

**Reason:** A runner recording what the representative said last month is not the
one claiming it. Collapsing actor into author attributes a person's own statement
to the machinery that filed it, and a guessed author cannot be told apart from a
real one.

**Caveat:** Events written before authorship existed are upcast on read with
`author: unattributed` and are never back-filled. History is not rewritten to fix
a shape (Art. 18); the upcast is a read-time projection, applied identically by
every storage adapter.

## ADR-023 — Employee, Responsibility, Capability, Runner

**Decision:** Accountability flows `Employee → Responsibility → Capability →
Runner`. Employees own responsibilities; capabilities own business logic; runners
execute it. Departments organize employees and never resolve one. Responsibilities
are typed ids assigned to exactly one employee in a single table. The manifest
binds responsibilities, not a department and an employee. Runner dispatch is keyed
by responsibility. Signatures come from the employee accountable for the
responsibility.

**Reason:** Resolving an employee from a department made a department and a person
the same thing, so a department could hold exactly one accountable employee
regardless of how many worked there. Employees change and capabilities do not;
replacing a person must not reach code that decides what the company does.

**Caveat:** No fallback of any kind is permitted in this chain. An unassigned
responsibility, an unknown employee, or a missing runner is an error at the point
of use — never a substitution of whoever or whatever is listed first. Silent
substitution is what made both previous failures invisible.

## ADR-024 — Progress requires an act, not a fact

**Decision:** Recording a `KnowledgeFact` does not advance a work order. A work
order moves to `working` only when something actually moves it. Until a work-start
event exists, an order stays `assigned` after facts are recorded.

**Reason:** Knowing something is not the same as having started the work. A
department may record what it read and get no further, and reporting that as
progress tells the representative something the record does not support (Art. 9).
