# Household Supplies Plugin Specification

Inventory and Shopping are distinct domain capabilities that, for the MVP, live
inside a single **Household Supplies** plugin (ADR-014). They share canonical
products, normalization, and the receipt workflow, so grouping them avoids a
premature boundary. They may be split into separate plugins later if a real
requirement forces it.

## Inventory entry

Supported initial sources:

1. Explicit text command
2. Confirmed receipt extraction
3. Later: voice through the same text/command pipeline

Examples:

- "계란 한 판하고 우유 두 개 샀어."
- "계란 두 개 먹었어."
- "우유 다 마셨어."

## Granularity

Use quantity tracking when meaningful:

- eggs: count
- tofu: pack/block
- milk: container

Use state tracking when exact measurement creates unnecessary burden:

- enough
- low
- out
- uncertain

Do not track precise milliliters or grams by default.

## Product normalization

Normalization draws on Knowledge reference data (canonical products, aliases and
synonyms, units and conversions, categories, normalization rules — ADR-015),
which is CRUD, not event-sourced.

Store:

- raw product name
- canonical product identity
- quantity
- unit
- extraction confidence
- confirmation status

Example:

```text
raw: 특란30
canonical: 계란
quantity: 30
unit: 개
```

## Freshness

The current inventory projection exposes `lastVerifiedAt`, `sourceType`,
`valueType`, and derived `freshnessStatus`, computed by the MVP freshness model
in `02-event-model.md`. Responses must distinguish a recent verified quantity
from an old purchase record and must not present an inferred status as a verified
count.

## Candidate commands

- PurchaseInventory
- ConsumeInventory
- DepleteInventory
- AdjustInventory
- RevertInventoryChange
- AddShoppingItem
- CompleteShoppingItem

## Candidate events

- InventoryPurchased
- InventoryConsumed
- InventoryDepleted
- InventoryAdjusted
- InventoryChangeReverted
- ShoppingItemAdded
- ShoppingItemCompleted
- ReceiptUploaded
- ReceiptConfirmed

## Automation

Low stock should initially generate a suggestion, not silently place an order.
The MVP implements this as an explicit hardcoded rule, not a generic rule engine
(ADR-016).

## Receipt workflow

Raw receipt images are stored in `ObjectStorage` and referenced via
`rawInputRef` (ADR-013). Receipt confirmation is a cross-plugin workflow and is
**orchestrated by the Application layer** (ADR-012). On confirmation the
orchestrator may:

- add inventory (Household Supplies reacts),
- complete matching shopping items (Household Supplies reacts),
- propose a household expense record (Finance reacts).

Plugins react through typed events and contracts; they do not call each other
directly. Financial mutation remains outside this plugin and requires its own
policy and confirmation (see the action policy in `03-ai-contract.md`).
