# Life OS — Claude Project Instructions

## Mission

Build an AI-based personal and household operating system.

The user speaks naturally through text, voice, or images. The system converts explicit user intent into validated domain commands, records immutable events, updates projections, and responds with evidence-aware results.

## Required reading policy

Do not load every document for every task.

Always read:
- `docs/00-context.md`
- `docs/01-architecture.md`
- the relevant plugin specification only

Read additional documents only when the task requires them:
- Event or projection work → `docs/02-event-model.md`
- AI parsing or routing → `docs/03-ai-contract.md`
- MVP prioritization → `docs/04-mvp.md`
- Architectural decisions → `docs/decisions.md`

## Architecture

The system is divided into:

1. Kernel — stable domain concepts
2. Application — orchestration and use cases
3. Infrastructure — replaceable technical adapters
4. Plugins — business capabilities

Dependency direction:

- Kernel depends on nothing external.
- Plugins depend on Kernel contracts.
- Application coordinates Kernel and Plugins.
- Infrastructure implements ports defined by inner layers.
- No domain code may import a concrete database, AI SDK, OAuth SDK, OCR SDK, or search SDK.

## Non-negotiable rules

- Events are the source of change history.
- Projections are derived read models, not authoritative history.
- Never mutate or delete historical events to correct a mistake; append a compensating event.
- AI never writes directly to storage.
- AI may produce only a typed command proposal.
- Server-side validation, authorization, and domain rules decide whether a command executes.
- Do not infer inventory consumption from a meal name.
- Only explicit user statements may change household state.
- Every command and event must include household/workspace scope and actor identity.
- Small reversible changes may execute immediately with Undo.
- Destructive, bulk, permission, or financial actions require confirmation.
- Current-state answers must consider freshness, source, and confidence.
- Do not introduce a graph database, microservices, dynamic plugin marketplace, Kafka, or other heavy infrastructure before a proven requirement exists.

## Working style

Before coding:
1. Identify the affected bounded context.
2. Read only the relevant documents.
3. State assumptions.
4. Propose the smallest vertical slice.
5. Update `docs/decisions.md` when making a durable architectural decision.

After coding:
1. Run tests and type checks.
2. Summarize changed behavior, not merely changed files.
3. Report unresolved risks honestly.
4. Update the relevant spec when behavior changed.

Prefer simple, typed, testable code over framework-heavy abstraction.
