# MVP and First Vertical Slice

## Goal

Validate the architecture end to end with Inventory and Shopping before expanding the platform.

## First vertical slice

```text
Google sign-in
→ create household
→ add wife and husband
→ create shared workspace
→ enter purchase through text
→ append purchase event
→ update inventory projection
→ enter consumption through text
→ append consumption event
→ query current inventory
→ suggest shopping when low
→ show history
→ undo through compensating event
```

Then add:

```text
receipt upload
→ OCR candidates
→ normalization
→ user confirmation
→ purchase events
→ shopping completion
```

Voice input comes after the text command flow is stable; it should reuse the same command contract.

## MVP plugins

- Identity foundation
- Inventory
- Shopping

Do not begin Finance, Travel, Resume, or Relationship implementation until the first vertical slice proves:

- event append
- projection rebuild
- permissions
- AI command proposal validation
- undo
- freshness-aware query
- plugin boundary

## Success criteria

A non-technical household member can:

- ask what is available,
- say what was bought or consumed,
- add something to shopping,
- correct a mistake,

without understanding the underlying data model.
