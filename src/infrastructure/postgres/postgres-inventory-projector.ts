import type { InventoryProjector } from "../../application/inventory-projector.js";
import type { StoredInventoryEvent } from "../../application/inventory-event-store.js";
import type { Tx } from "../../application/unit-of-work.js";

import { getPostgresClient } from "./postgres-unit-of-work.js";

export class PostgresInventoryProjector
  implements InventoryProjector
{
  async project(
    tx: Tx,
    event: StoredInventoryEvent,
  ): Promise<void> {
    const client = getPostgresClient(tx);

    const direction =
      event.eventType === "InventoryPurchased" ? 1 : -1;

    for (const item of event.payload.items) {
      const quantityChange = item.quantity * direction;

      await client.query(
        `
          INSERT INTO inventory_items (
            workspace_id,
            canonical_product_id,
            canonical_name,
            quantity,
            unit,
            last_verified_at,
            source_type,
            value_type,
            freshness_status,
            last_seq
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10
          )
          ON CONFLICT (
            workspace_id,
            canonical_product_id
          )
          DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            quantity =
              inventory_items.quantity
              + EXCLUDED.quantity,
            unit = EXCLUDED.unit,
            last_verified_at =
              EXCLUDED.last_verified_at,
            source_type = EXCLUDED.source_type,
            value_type = EXCLUDED.value_type,
            freshness_status =
              EXCLUDED.freshness_status,
            last_seq = EXCLUDED.last_seq,
            updated_at = now()
          WHERE inventory_items.last_seq
            < EXCLUDED.last_seq
        `,
        [
          event.workspaceId,
          item.canonicalProductId,
          item.canonicalName,
          quantityChange,
          item.unit,
          event.occurredAt,
          "explicit_text",
          "explicit_quantity",
          "fresh",
          event.seq,
        ],
      );
    }
  }
}