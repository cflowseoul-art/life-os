import type { ProcessedCommandStore } from "../../application/processed-command-store.js";
import type { Tx } from "../../application/unit-of-work.js";
import type { ExecutedResult } from "../../household-supplies/types.js";

import { getPostgresClient } from "./postgres-unit-of-work.js";

type ProcessedCommandRow = {
  response: ExecutedResult | string;
};

export class PostgresProcessedCommandStore
  implements ProcessedCommandStore
{
  async findByIdempotencyKey(
    tx: Tx,
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<ExecutedResult | null> {
    const client = getPostgresClient(tx);

    const queryResult =
      await client.query<ProcessedCommandRow>(
        `
          SELECT response
          FROM processed_commands
          WHERE workspace_id = $1
            AND idempotency_key = $2
          LIMIT 1
        `,
        [
          workspaceId,
          idempotencyKey,
        ],
      );

    const row = queryResult.rows[0];

    if (!row) {
      return null;
    }

    if (typeof row.response === "string") {
      return JSON.parse(
        row.response,
      ) as ExecutedResult;
    }

    return row.response;
  }

  async save(
    tx: Tx,
    workspaceId: string,
    commandId: string,
    idempotencyKey: string,
    result: ExecutedResult,
  ): Promise<void> {
    const client = getPostgresClient(tx);

    await client.query(
      `
        INSERT INTO processed_commands (
          workspace_id,
          command_id,
          idempotency_key,
          response
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::jsonb
        )
        ON CONFLICT (
          workspace_id,
          idempotency_key
        )
        DO NOTHING
      `,
      [
        workspaceId,
        commandId,
        idempotencyKey,
        JSON.stringify(result),
      ],
    );
  }
}
