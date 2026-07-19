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
→ typed command proposal
→ server validation
→ authorization
→ domain command
→ event
→ projection
→ response
```

## Example proposal

```json
{
  "intent": "consume_inventory",
  "targetPlugin": "inventory",
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

## Ambiguity policy

- “계란 두 개 먹었어” → explicit; propose decrement by 2.
- “김치찌개 먹었어” → do not infer ingredient consumption.
- “계란 좀 먹었어” → quantity unclear; ask or use a non-numeric status only when the domain explicitly supports it.
- Low-confidence receipt items → present confirmation candidates.

## Context economy

Provide the model only:

1. the current user request,
2. relevant plugin intent schema,
3. minimum current state needed,
4. applicable permissions and policies.

Do not send the entire repository documentation to the model.
