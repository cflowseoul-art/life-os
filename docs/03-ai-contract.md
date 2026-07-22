# AI Contract

## AI responsibility

AI may:

- classify intent
- extract entities, quantities, units, dates, and scope
- normalize raw names into candidates
- produce a typed command proposal
- ask for clarification
- explain outcomes

AI may not:

- access storage directly
- bypass authorization
- decide protected business rules
- silently infer state-changing facts
- fabricate confidence or data freshness

## Pipeline

```text
Text / voice / image
→ provider preprocessing
→ AI router
→ typed command proposal (with confidence)
→ server validation
→ authorization
→ action policy (see below)
→ domain command (commandId + idempotencyKey)
→ event
→ synchronous projection
→ response
```

## Example proposal

```json
{
  "intent": "consume_inventory",
  "targetPlugin": "household-supplies",
  "workspace": "shared-household",
  "arguments": {
    "items": [
      {
        "canonicalName": "계란",
        "quantity": 2,
        "unit": "개"
      }
    ]
  },
  "confidence": 0.98,
  "requiresClarification": false
}
```

## Action policy (confidence decision matrix)

The server, not the AI, decides whether a validated proposal auto-executes,
requires confirmation, or needs clarification. The decision uses four inputs:

- **confidence** — `high` (≥ 0.85), `medium` (0.60–0.85), `low` (< 0.60)
- **reversibility** — reversible (compensatable) vs irreversible
- **blast radius** — single item vs bulk / destructive
- **financial sensitivity** — does it move money or create a financial record?

Rules are evaluated in priority order; the first match wins:

| # | Condition | Action |
|---|-----------|--------|
| 1 | `requiresClarification = true`, or confidence `low` | **Ask clarification** |
| 2 | Financial sensitivity = yes | **Confirm** (never auto-execute) |
| 3 | Blast radius = bulk / destructive | **Confirm** |
| 4 | Reversibility = irreversible | **Confirm** |
| 5 | Confidence `high`, reversible, single item, non-financial | **Auto-execute with Undo** |
| 6 | Confidence `medium`, reversible, single item, non-financial | **Auto-execute with Undo, with the interpretation shown explicitly** |

Undo is implemented as a compensating event, never as history deletion.
Thresholds are tunable and are treated as configuration, not domain rules.
This matrix is the concrete expression of ADR-009.

## Ambiguity policy

- "계란 두 개 먹었어" → explicit; propose decrement by 2.
- "김치찌개 먹었어" → do not infer ingredient consumption.
- "계란 좀 먹었어" → quantity unclear; ask or use a non-numeric status only when
  the domain explicitly supports it.
- Low-confidence receipt items → present confirmation candidates.

## Evaluation (Korean golden dataset)

AI parsing must be validated against a **Korean golden dataset** and a
**regression harness** before it is trusted in the flow (ADR-011):

- The golden set pairs realistic Korean utterances and receipt extractions with
  their expected typed proposals (intent, entities, quantities, units, scope,
  canonical normalization).
- The harness scores intent accuracy, entity/quantity/unit extraction, and
  normalization correctness, and reports regressions on every change to prompts,
  models, or normalization rules.
- The harness runs without the database or event store, so parsing quality can
  be measured independently of persistence.

## Context economy

Provide the model only:

1. the current user request,
2. relevant plugin intent schema,
3. minimum current state needed,
4. applicable permissions and policies.

Do not send the entire repository documentation to the model.
