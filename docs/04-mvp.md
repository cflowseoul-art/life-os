# MVP and First Vertical Slice

## Goal

Validate the architecture end to end with the Household Supplies plugin
(Inventory + Shopping) before expanding the platform. The first slice must
exercise both **Korean input parsing** and the **command → event → synchronous
projection** path together — not one without the other.

## First vertical slice

```text
Google sign-in
→ create household
→ add wife and husband
→ create shared workspace
→ enter purchase through Korean text
→ AI parse → typed command proposal
→ action policy decision
→ append purchase event + update inventory projection (one transaction)
→ enter consumption through Korean text
→ append consumption event + update projection (one transaction)
→ query current inventory (freshness-aware)
→ suggest shopping when low (hardcoded automation rule)
→ show history
→ undo through compensating event
```

Then add:

```text
receipt upload
→ store raw image in ObjectStorage
→ OCR candidates
→ normalization
→ user confirmation
→ Application orchestrates: purchase events + shopping completion (+ proposed expense)
```

Voice input comes after the text command flow is stable; it should reuse the same
command contract and the same `idempotencyKey` deduplication.

## MVP plugins

- Identity foundation (CRUD)
- Household Supplies (Inventory + Shopping capabilities)

Do not begin Finance, Travel, Resume, or Relationship implementation until the
first vertical slice proves:

- command idempotency (commandId + idempotencyKey)
- event append
- synchronous projection update
- projection rebuild from history
- permissions
- AI command proposal validation and the confidence action policy
- Korean golden-dataset parsing accuracy
- undo
- freshness-aware query
- plugin boundary

## Success criteria

A non-technical household member can:

- ask what is available,
- say what was bought or consumed,
- add something to shopping,
- correct a mistake,

without understanding the underlying data model — and the AI parsing meets the
golden-dataset accuracy bar before the flow is trusted.
