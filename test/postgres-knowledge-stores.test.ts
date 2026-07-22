import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import { PostgresKnowledgeDocumentStore } from "../src/infrastructure/postgres/postgres-knowledge-document-store.js";
import { PostgresKnowledgeSourceStore } from "../src/infrastructure/postgres/postgres-knowledge-source-store.js";
import { PostgresUnitOfWork } from "../src/infrastructure/postgres/postgres-unit-of-work.js";

function createMockDatabase(
  rows: unknown[],
) {
  const query = vi.fn(
    async (
      sql: string,
      _parameters?: unknown[],
    ) => {
      if (
        sql === "BEGIN"
        || sql === "COMMIT"
        || sql === "ROLLBACK"
      ) {
        return {
          rows: [],
        };
      }

      return {
        rows,
      };
    },
  );

  const client = {
    query,
    release: vi.fn(),
  } as unknown as PoolClient;

  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pick<Pool, "connect">;

  return {
    pool,
    query,
  };
}

describe("PostgreSQL Knowledge stores", () => {
  it("saves and maps a knowledge source", async () => {
    const database = createMockDatabase([
      {
        source_id:
          "11111111-1111-4111-8111-111111111111",
        workspace_id:
          "22222222-2222-4222-8222-222222222222",
        source_type: "apple_notes",
        name: "Apple Notes",
        external_reference:
          "apple-notes-primary",
        created_at:
          "2026-07-22T03:00:00.000Z",
        updated_at:
          "2026-07-22T03:00:00.000Z",
      },
    ]);

    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const store =
      new PostgresKnowledgeSourceStore();

    const result = await unitOfWork.transaction(
      (tx) =>
        store.save(tx, {
          sourceId:
            "11111111-1111-4111-8111-111111111111",
          workspaceId:
            "22222222-2222-4222-8222-222222222222",
          sourceType: "apple_notes",
          name: "Apple Notes",
          externalReference:
            "apple-notes-primary",
          createdAt:
            "2026-07-22T03:00:00.000Z",
          updatedAt:
            "2026-07-22T03:00:00.000Z",
        }),
    );

    expect(result.sourceType).toBe(
      "apple_notes",
    );

    expect(result.externalReference).toBe(
      "apple-notes-primary",
    );

    expect(
      database.query.mock.calls.some(([sql]) =>
        String(sql).includes(
          "INSERT INTO knowledge_sources",
        ),
      ),
    ).toBe(true);
  });

  it("saves and maps a knowledge document", async () => {
    const database = createMockDatabase([
      {
        document_id:
          "33333333-3333-4333-8333-333333333333",
        workspace_id:
          "22222222-2222-4222-8222-222222222222",
        source_id:
          "11111111-1111-4111-8111-111111111111",
        external_id: "apple-note-001",
        folder_path: "Life OS",
        title: "Life OS 설계",
        content: "설계 내용",
        source_created_at: null,
        source_updated_at: null,
        imported_at:
          "2026-07-22T03:10:00.000Z",
        content_hash: "content-hash",
        status: "active",
      },
    ]);

    const unitOfWork =
      new PostgresUnitOfWork(database.pool);

    const store =
      new PostgresKnowledgeDocumentStore();

    const result = await unitOfWork.transaction(
      (tx) =>
        store.save(tx, {
          documentId:
            "33333333-3333-4333-8333-333333333333",
          workspaceId:
            "22222222-2222-4222-8222-222222222222",
          sourceId:
            "11111111-1111-4111-8111-111111111111",
          externalId: "apple-note-001",
          folderPath: "Life OS",
          title: "Life OS 설계",
          content: "설계 내용",
          sourceCreatedAt: null,
          sourceUpdatedAt: null,
          importedAt:
            "2026-07-22T03:10:00.000Z",
          contentHash: "content-hash",
          status: "active",
        }),
    );

    expect(result.documentId).toBe(
      "33333333-3333-4333-8333-333333333333",
    );

    expect(result.title).toBe("Life OS 설계");

    expect(
      database.query.mock.calls.some(([sql]) =>
        String(sql).includes(
          "INSERT INTO knowledge_documents",
        ),
      ),
    ).toBe(true);
  });
});
