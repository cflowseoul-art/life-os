import type { Pool } from "pg";

import type {
  AssistantInteractionStore,
} from "../../application/assistant-interaction-store.js";

export class PostgresAssistantInteractionStore
  implements AssistantInteractionStore
{
  constructor(
    private readonly pool: Pick<Pool, "query">,
  ) {}

  async save(input: {
    workspaceId: string;
    inputText: string;
    intent?: string;
    commandType?: string;
    success: boolean;
    responseTimeMs?: number;
    metadata?: unknown;
  }): Promise<void> {

    await this.pool.query(
      `
      INSERT INTO assistant_interactions (
        id,
        workspace_id,
        input_text,
        intent,
        command_type,
        success,
        response_time_ms,
        metadata
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      `,
      [
        input.workspaceId,
        input.inputText,
        input.intent ?? null,
        input.commandType ?? null,
        input.success,
        input.responseTimeMs ?? null,
        input.metadata ?? null,
      ],
    );
  }
}
