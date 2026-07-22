# Life OS Context

## Product definition

Life OS is not a collection of CRUD dashboards. It is an AI-based operating system for personal and household life.

Core statement:

> People converse; the system records events, calculates current state, connects meaning, and supports action.

## Users

- Wife: administrator and full-feature user
- Husband: conversational user with simple shared actions
- AI: interpretation and interaction layer, never an authority that bypasses domain rules

## Scope model

```text
Household
├── User: Wife
├── User: Husband
└── Workspaces
    ├── Wife Personal
    ├── Husband Personal
    └── Shared Household
```

All major records must be scoped by household/workspace and protected by permissions.

## Permission assumptions (MVP)

The MVP uses a small, fixed model — not enterprise RBAC (ADR-010):

- Wife and husband belong to the same household.
- Shared assets and household supplies are visible and editable by both.
- Every record and event retains actor ownership and actor attribution (`actorId`).
- Administrative actions (managing membership, product catalog, normalization
  rules, and automation configuration) are limited to the admin role (wife).
- Some personal domains may later support private workspaces; the MVP scopes by
  workspace but does not yet enforce hard privacy walls.

## Product principles

1. Do not build a feature without a trustworthy data source.
2. Automate repeatable capture where practical.
3. Prefer conversation for quick input and query.
4. Keep screens for review, correction, history, and settings.
5. AI must represent uncertainty rather than fabricate certainty.
6. Record explicit facts; do not silently infer state-changing facts.
7. Optimize for daily usability across Mac, iPhone, and Android.
8. Start as a web application with Google sign-in.
9. Build for two users without prematurely building a generic SaaS platform.
