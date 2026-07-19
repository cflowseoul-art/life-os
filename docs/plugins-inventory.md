# Inventory and Shopping Plugin Specification

## Inventory entry

Supported initial sources:

1. Explicit text command
2. Confirmed receipt extraction
3. Later: voice through the same text/command pipeline

Examples:

- “계란 한 판하고 우유 두 개 샀어.”
- “계란 두 개 먹었어.”
- “우유 다 마셨어.”

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

Current inventory projection should expose:

- lastConfirmedAt
- source
- confidence
- freshness status

Responses must distinguish a recent verified quantity from an old purchase record.

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

Receipt confirmation may:

- add inventory,
- complete matching shopping items,
- propose a household expense record.

Financial mutation remains outside this plugin and requires its own policy.
