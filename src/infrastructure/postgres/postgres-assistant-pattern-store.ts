import type { Pool } from "pg";

import type {
  AssistantPatternStore,
} from "../../application/assistant-pattern-store.js";


type PatternRow = {
  intent: string;
  commandType: string;
  payload: unknown;
  hitCount: number;
};


export class PostgresAssistantPatternStore
  implements AssistantPatternStore
{
  constructor(
    private readonly pool: Pick<Pool, "query">,
  ) {}


  async find(input: {
    workspaceId: string;
    inputText: string;
  }) {
    const result =
      await this.pool.query<PatternRow>(
        `
        SELECT
          intent,
          command_type AS "commandType",
          payload,
          hit_count AS "hitCount"
        FROM assistant_patterns
        WHERE workspace_id = $1
          AND input_text = $2
        LIMIT 1
        `,
        [
          input.workspaceId,
          input.inputText,
        ],
      );


    const row =
      result.rows[0];

    if (!row) {
      return null;
    }


    await this.pool.query(
      `
      UPDATE assistant_patterns
      SET
        hit_count = hit_count + 1,
        updated_at = now()
      WHERE workspace_id = $1
        AND input_text = $2
      `,
      [
        input.workspaceId,
        input.inputText,
      ],
    );


    return row;
  }


  async save(input: {
    workspaceId: string;
    inputText: string;
    intent: string;
    commandType: string;
    payload: unknown;
  }) {

    await this.pool.query(
      `
      INSERT INTO assistant_patterns (
        id,
        workspace_id,
        input_text,
        intent,
        command_type,
        payload
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5
      )
      ON CONFLICT (
        workspace_id,
        input_text
      )
      DO UPDATE SET
        hit_count = assistant_patterns.hit_count + 1,
        updated_at = now()
      `,
      [
        input.workspaceId,
        input.inputText,
        input.intent,
        input.commandType,
        input.payload,
      ],
    );
  }
}
