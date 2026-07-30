import type {
  InventoryEventStore,
  StoredInventoryEvent,
} from "../../application/inventory-event-store.js";
import type { Tx } from "../../application/unit-of-work.js";
import type { InventoryEvent } from "../../household-supplies/types.js";

import { getPostgresClient } from "./postgres-unit-of-work.js";

type InsertedEventRow = {
  seq: string;
};

export class PostgresInventoryEventStore
  implements InventoryEventStore
{
  async append(
    tx: Tx,
    event: InventoryEvent,
  ): Promise<StoredInventoryEvent> {
    const client = getPostgresClient(tx);

    const result = await client.query<InsertedEventRow>(
      `
        INSERT INTO inventory_events (
          event_id,
          event_type,
          event_version,
          aggregate_type,
          aggregate_id,
          household_id,
          workspace_id,
          actor_id,
          occurred_at,
          correlation_id,
          causation_id,
          command_id,
          idempotency_key,
          payload,
          metadata
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
          $10,
          $11,
          $12,
          $13,
          $14::jsonb,
          $15::jsonb
        )
        RETURNING seq
      `,
      [
        event.eventId,
        event.eventType,
        event.eventVersion,
        event.aggregateType,
        event.aggregateId,
        event.householdId,
        event.workspaceId,
        event.actorId,
        event.occurredAt,
        event.correlationId,
        event.causationId ?? null,
        event.commandId,
        event.idempotencyKey,
        JSON.stringify(event.payload),
        event.metadata
          ? JSON.stringify(event.metadata)
          : null,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Inventory event insert returned no row");
    }

    const seq = Number(row.seq);

    if (!Number.isSafeInteger(seq)) {
      throw new Error(`Invalid inventory event sequence: ${row.seq}`);
    }

    return {
      ...event,
      seq,
    };
  }

  async findLatestPurchase(
    tx: Tx,
    workspaceId: string,
  ): Promise<StoredInventoryEvent | null> {
    const client = getPostgresClient(tx);

    const result =
      await client.query(
        `
        SELECT
          seq,
          event_id,
          event_type,
          event_version,
          aggregate_type,
          aggregate_id,
          household_id,
          workspace_id,
          actor_id,
          occurred_at,
          correlation_id,
          command_id,
          idempotency_key,
          payload,
          metadata
        FROM inventory_events
        WHERE workspace_id = $1
          AND event_type = 'InventoryPurchased'
        ORDER BY seq DESC
        LIMIT 1
        `,
        [
          workspaceId,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      seq: Number(row.seq),
      eventId: row.event_id,
      eventType: row.event_type,
      eventVersion: row.event_version,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      householdId: row.household_id,
      workspaceId: row.workspace_id,
      actorId: row.actor_id,
      occurredAt: row.occurred_at,
      correlationId: row.correlation_id,
      commandId: row.command_id,
      idempotencyKey: row.idempotency_key,
      payload: row.payload,
      metadata: row.metadata,
    };
  }

}