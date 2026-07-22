import type { KnowledgeDocumentStore } from "../../application/knowledge-document-store.js";
import type { Tx } from "../../application/unit-of-work.js";
import type {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  SaveKnowledgeDocumentInput,
} from "../../knowledge/types.js";

import { getPostgresClient } from "./postgres-unit-of-work.js";

type KnowledgeDocumentRow = {
  document_id: string;
  workspace_id: string;
  source_id: string;
  external_id: string | null;
  folder_path: string | null;
  title: string;
  content: string;
  source_created_at: Date | string | null;
  source_updated_at: Date | string | null;
  imported_at: Date | string;
  content_hash: string;
  status: KnowledgeDocumentStatus;
};

export class PostgresKnowledgeDocumentStore
  implements KnowledgeDocumentStore
{
  async save(
    tx: Tx,
    document: SaveKnowledgeDocumentInput,
  ): Promise<KnowledgeDocument> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeDocumentRow>(
        `
          INSERT INTO knowledge_documents (
            document_id,
            workspace_id,
            source_id,
            external_id,
            folder_path,
            title,
            content,
            source_created_at,
            source_updated_at,
            imported_at,
            content_hash,
            status
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
            $12
          )
          ON CONFLICT (document_id)
          DO UPDATE SET
            external_id = EXCLUDED.external_id,
            folder_path = EXCLUDED.folder_path,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            source_created_at =
              EXCLUDED.source_created_at,
            source_updated_at =
              EXCLUDED.source_updated_at,
            imported_at = EXCLUDED.imported_at,
            content_hash = EXCLUDED.content_hash,
            status = EXCLUDED.status,
            updated_at = now()
          RETURNING
            document_id,
            workspace_id,
            source_id,
            external_id,
            folder_path,
            title,
            content,
            source_created_at,
            source_updated_at,
            imported_at,
            content_hash,
            status
        `,
        [
          document.documentId,
          document.workspaceId,
          document.sourceId,
          document.externalId,
          document.folderPath,
          document.title,
          document.content,
          document.sourceCreatedAt,
          document.sourceUpdatedAt,
          document.importedAt,
          document.contentHash,
          document.status,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "Knowledge document was not saved",
      );
    }

    return this.mapRow(row);
  }

  async findById(
    tx: Tx,
    workspaceId: string,
    documentId: string,
  ): Promise<KnowledgeDocument | null> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeDocumentRow>(
        `
          SELECT
            document_id,
            workspace_id,
            source_id,
            external_id,
            folder_path,
            title,
            content,
            source_created_at,
            source_updated_at,
            imported_at,
            content_hash,
            status
          FROM knowledge_documents
          WHERE workspace_id = $1
            AND document_id = $2
          LIMIT 1
        `,
        [
          workspaceId,
          documentId,
        ],
      );

    const row = result.rows[0];

    return row ? this.mapRow(row) : null;
  }

  async findByExternalId(
    tx: Tx,
    workspaceId: string,
    sourceId: string,
    externalId: string,
  ): Promise<KnowledgeDocument | null> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeDocumentRow>(
        `
          SELECT
            document_id,
            workspace_id,
            source_id,
            external_id,
            folder_path,
            title,
            content,
            source_created_at,
            source_updated_at,
            imported_at,
            content_hash,
            status
          FROM knowledge_documents
          WHERE workspace_id = $1
            AND source_id = $2
            AND external_id = $3
          LIMIT 1
        `,
        [
          workspaceId,
          sourceId,
          externalId,
        ],
      );

    const row = result.rows[0];

    return row ? this.mapRow(row) : null;
  }

  async listByWorkspaceId(
    tx: Tx,
    workspaceId: string,
  ): Promise<KnowledgeDocument[]> {
    const client = getPostgresClient(tx);

    const result =
      await client.query<KnowledgeDocumentRow>(
        `
          SELECT
            document_id,
            workspace_id,
            source_id,
            external_id,
            folder_path,
            title,
            content,
            source_created_at,
            source_updated_at,
            imported_at,
            content_hash,
            status
          FROM knowledge_documents
          WHERE workspace_id = $1
            AND status <> 'deleted'
          ORDER BY
            imported_at DESC,
            document_id ASC
        `,
        [workspaceId],
      );

    return result.rows.map((row) =>
      this.mapRow(row),
    );
  }

  private mapRow(
    row: KnowledgeDocumentRow,
  ): KnowledgeDocument {
    return {
      documentId: row.document_id,
      workspaceId: row.workspace_id,
      sourceId: row.source_id,
      externalId: row.external_id,
      folderPath: row.folder_path,
      title: row.title,
      content: row.content,
      sourceCreatedAt: this.toNullableIsoString(
        row.source_created_at,
      ),
      sourceUpdatedAt: this.toNullableIsoString(
        row.source_updated_at,
      ),
      importedAt: this.toIsoString(
        row.imported_at,
      ),
      contentHash: row.content_hash,
      status: row.status,
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

  private toNullableIsoString(
    value: Date | string | null,
  ): string | null {
    if (value === null) {
      return null;
    }

    return this.toIsoString(value);
  }
}
