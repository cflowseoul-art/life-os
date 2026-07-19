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
│   └── Unified search
│
├── Infrastructure
│   ├── Storage
│   ├── AI provider
│   ├── Search index
│   ├── Authentication provider
│   ├── Speech provider
│   ├── OCR provider
│   └── Notification provider
│
└── Plugins
    ├── Inventory
    ├── Shopping
    ├── Planner
    ├── Finance
    ├── Resume
    ├── Travel
    └── Relationship
```

## Kernel responsibilities

### Identity
Who owns data, who can access it, and which actions they may perform.

### Event
What happened, who caused it, when it happened, and which aggregate it affects.

### Knowledge
What an entity means and how it relates to other entities.

### Automation
Which trigger, condition, and action define a controlled automatic workflow.

## Infrastructure rule

Infrastructure is explicit but replaceable.

Kernel code must not know PostgreSQL, Supabase, OpenAI, Google OAuth, or a particular search service. It knows only ports such as `EventStore`, `IdentityRepository`, `AIProvider`, and `SearchIndex`.

## Plugin rule

A plugin is an internal bounded-context module, not initially a dynamically installed package.

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

Avoid cross-plugin direct table access. Interactions occur through application contracts, events, or explicit public interfaces.
