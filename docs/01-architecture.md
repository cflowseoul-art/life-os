# System Architecture

## Layers

```text
Life OS
├── Kernel
│   ├── Identity
│   ├── Event
│   ├── Knowledge
│   └── Automation
│
├── Application
│   ├── Command handling
│   ├── Query handling
│   ├── AI routing
│   ├── Unified search
│   └── Workflow orchestration (e.g. receipt confirmation)
│
├── Infrastructure
│   ├── Storage (PostgreSQL: events, projections, FTS, vectors)
│   ├── Object storage (raw receipt images, future audio)
│   ├── AI provider
│   ├── Search index (initially backed by PostgreSQL)
│   ├── Authentication provider
│   ├── Speech provider
│   ├── OCR provider
│   └── Notification provider
│
└── Plugins
    ├── Household Supplies (Inventory + Shopping capabilities)
    ├── Planner
    ├── Finance
    ├── Resume
    ├── Travel
    └── Relationship
```

## Kernel responsibilities

### Identity
Who owns data, who can access it, and which actions they may perform.
See ADR-010 for the MVP permission model. Identity, Household, Workspace, and
Membership are CRUD entities, not event-sourced.

### Event
What happened, who caused it, when it happened, and which aggregate it affects.
Event sourcing is scoped (ADR-007); not every entity is event-sourced.

### Knowledge
What an entity means and how it relates to other entities.
For MVP, Knowledge is deliberately narrow (ADR-015): canonical products,
aliases and synonyms, units and conversions, categories, and normalization
rules. It is stored as CRUD reference data — not a graph database.

### Automation
Which trigger, condition, and action define a controlled automatic workflow.
Automation remains an architectural capability, but the MVP implementation
contains only explicit hardcoded rules such as low-stock shopping suggestions
(ADR-016). Do not build a generic rule engine before a proven requirement.

## Infrastructure rule

Infrastructure is explicit but replaceable.

Kernel code must not know PostgreSQL, Supabase, OpenAI, Google OAuth, an object
store, or a particular search service. It knows only ports such as `EventStore`,
`IdentityRepository`, `AIProvider`, `SearchIndex`, and `ObjectStorage`.

The MVP backs `SearchIndex` with PostgreSQL full-text search and vectors. A
separate search service is not introduced until a proven requirement exists.

Raw inputs (receipt images, later audio) are held in `ObjectStorage` and
referenced from event metadata via `rawInputRef`. Retention is governed by
ADR-013.

## Plugin rule

A plugin is an internal bounded-context module, not initially a dynamically
installed package.

Inventory and Shopping remain distinct domain capabilities, but for the MVP they
live inside a single **Household Supplies** plugin (ADR-014). They are split into
separate plugins only when a second capability forces the boundary.

Each plugin may expose:

- Commands
- Queries
- Events
- Policies
- Permissions
- Automation rules
- AI intents
- Search documents
- UI routes

Avoid cross-plugin direct table access. Interactions occur through application
contracts, events, or explicit public interfaces. Cross-plugin workflows (such
as receipt confirmation, which spans supplies and finance) are orchestrated by
the Application layer; plugins react through typed events and contracts (ADR-012).
