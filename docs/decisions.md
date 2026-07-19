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
