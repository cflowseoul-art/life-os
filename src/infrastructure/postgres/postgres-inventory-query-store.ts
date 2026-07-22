import type { InventoryQueryStore } from "../../application/inventory-query-store.js";
import type { Tx } from "../../application/unit-of-work.js";
import type { InventoryItemState } from "../../household-supplies/types.js";

import { getPostgresClient } from "./postgres-unit-of-work.js";

type InventoryItemRow = {
  workspace_id: string;
  canonical_product_id: string;
  canonical_name: string;
  quantity: string;
  unit: string;
  last_verified_at: Date | string;
  source_type: InventoryItemState["sourceType"];
  value_type: InventoryItemState["valueType"];
  freshness_status: InventoryItemState["freshnessStatus"];
  last_seq: string;
};

export class PostgresInventoryQueryStore
  implements InventoryQueryStore
{
  async findAvailableByWorkspaceId(
    tx: Tx,
    workspaceId: string,
  ): Promise<InventoryItemState[]> {
    const client = getPostgresClient(tx);

    const result = await client.query<InventoryItemRow>(
      `
        SELECT
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
        FROM inventory_items
        WHERE workspace_id = $1
          AND quantity > 0
        ORDER BY
          canonical_name ASC,
          canonical_product_id ASC
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      workspaceId: row.workspace_id,
      canonicalProductId: row.canonical_product_id,
      canonicalName: row.canonical_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      lastVerifiedAt: this.toIsoString(
        row.last_verified_at,
      ),
      sourceType: row.source_type,
      valueType: row.value_type,
      freshnessStatus: row.freshness_status,
      lastSeq: Number(row.last_seq),
    }));
  }

  private toIsoString(
    value: Date | string,
  ): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }
}