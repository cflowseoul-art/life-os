import type { KnowledgeSourceStore } from "../../application/knowledge-source-store.js";
import type { Tx } from "../../application/unit-of-work.js";
import type {
  KnowledgeSource,
  KnowledgeSourceType,
  SaveKnowledgeSourceInput,
} from "../../knowledge/types.js";

import { getPostgresClient } from "./postgres-unit-of-work.js";

type KnowledgeSourceRow = {
  source_id: string;
  workspace_id: string;
  source_type: KnowledgeSourceType;
  name: string;
  external_reference: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export class PostgresKnowledgeSourceStore
  implements KnowledgeSourceStore
{
  async save(
    tx: Tx,
    source: SaveKnowledgeSourceInput,
  ): Promise<KnowledgeSource> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeSourceRow>(
        `
          INSERT INTO knowledge_sources (
            source_id,
            workspace_id,
            source_type,
            name,
            external_reference,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
          ON CONFLICT (source_id)
          DO UPDATE SET
            source_type = EXCLUDED.source_type,
            name = EXCLUDED.name,
            external_reference =
              EXCLUDED.external_reference,
            updated_at = EXCLUDED.updated_at
          RETURNING
            source_id,
            workspace_id,
            source_type,
            name,
            external_reference,
            created_at,
            updated_at
        `,
        [
          source.sourceId,
          source.workspaceId,
          source.sourceType,
          source.name,
          source.externalReference,
          source.createdAt,
          source.updatedAt,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "Knowledge source was not saved",
      );
    }

    return this.mapRow(row);
  }

  async findById(
    tx: Tx,
    workspaceId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeSourceRow>(
        `
          SELECT
            source_id,
            workspace_id,
            source_type,
            name,
            external_reference,
            created_at,
            updated_at
          FROM knowledge_sources
          WHERE workspace_id = $1
            AND source_id = $2
          LIMIT 1
        `,
        [
          workspaceId,
          sourceId,
        ],
      );

    const row = result.rows[0];

    return row ? this.mapRow(row) : null;
  }

  async findByExternalReference(
    tx: Tx,
    workspaceId: string,
    externalReference: string,
  ): Promise<KnowledgeSource | null> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeSourceRow>(
        `
          SELECT
            source_id,
            workspace_id,
            source_type,
            name,
            external_reference,
            created_at,
            updated_at
          FROM knowledge_sources
          WHERE workspace_id = $1
            AND external_reference = $2
          LIMIT 1
        `,
        [
          workspaceId,
          externalReference,
        ],
      );

    const row = result.rows[0];

    return row ? this.mapRow(row) : null;
  }

  async listByWorkspaceId(
    tx: Tx,
    workspaceId: string,
  ): Promise<KnowledgeSource[]> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeSourceRow>(
        `
          SELECT
            source_id,
            workspace_id,
            source_type,
            name,
            external_reference,
            created_at,
            updated_at
          FROM knowledge_sources
          WHERE workspace_id = $1
          ORDER BY
            name ASC,
            source_id ASC
        `,
        [workspaceId],
      );

    return result.rows.map((row) =>
      this.mapRow(row),
    );
  }

  private mapRow(
    row: KnowledgeSourceRow,
  ): KnowledgeSource {
    return {
      sourceId: row.source_id,
      workspaceId: row.workspace_id,
      sourceType: row.source_type,
      name: row.name,
      externalReference:
        row.external_reference,
      createdAt: this.toIsoString(
        row.created_at,
      ),
      updatedAt: this.toIsoString(
        row.updated_at,
      ),
    };
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
