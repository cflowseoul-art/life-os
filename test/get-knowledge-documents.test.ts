import { describe, expect, it, vi } from "vitest";

import { GetKnowledgeDocuments } from "../src/application/get-knowledge-documents.js";
import type { KnowledgeDocumentStore } from "../src/application/knowledge-document-store.js";
import type {
  Tx,
  UnitOfWork,
} from "../src/application/unit-of-work.js";
import type { KnowledgeDocument } from "../src/knowledge/types.js";

const tx: Tx = {};

const workspaceId =
  "11111111-1111-4111-8111-111111111111";

function createDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    documentId:
      "22222222-2222-4222-8222-222222222222",
    workspaceId,
    sourceId:
      "33333333-3333-4333-8333-333333333333",
    externalId: "apple-note-001",
    folderPath: "Life OS",
    title: "Life OS 설계",
    content: "Life OS 설계 내용",
    sourceCreatedAt: null,
    sourceUpdatedAt: null,
    importedAt: "2026-07-22T03:20:00.000Z",
    contentHash: "content-hash",
    status: "active",
    ...overrides,
  };
}

function createDependencies() {
  let transactionCallCount = 0;

  const unitOfWork: UnitOfWork = {
    async transaction<T>(
      work: (transaction: Tx) => Promise<T>,
    ): Promise<T> {
      transactionCallCount += 1;
      return work(tx);
    },
  };

  const knowledgeDocumentStore: KnowledgeDocumentStore = {
    save: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    listByWorkspaceId: vi.fn(),
  };

  return {
    unitOfWork,
    knowledgeDocumentStore,
    getTransactionCallCount: () =>
      transactionCallCount,
  };
}

describe("GetKnowledgeDocuments", () => {
  it("returns documents in a workspace", async () => {
    const dependencies = createDependencies();

    const documents = [
      createDocument(),
      createDocument({
        documentId:
          "44444444-4444-4444-8444-444444444444",
        title: "두 번째 메모",
      }),
    ];

    vi.mocked(
      dependencies.knowledgeDocumentStore
        .listByWorkspaceId,
    ).mockResolvedValue(documents);

    const service = new GetKnowledgeDocuments(
      dependencies.unitOfWork,
      dependencies.knowledgeDocumentStore,
    );

    const result = await service.execute(
      workspaceId,
    );

    expect(result).toEqual(documents);

    expect(
      dependencies.knowledgeDocumentStore
        .listByWorkspaceId,
    ).toHaveBeenCalledWith(
      tx,
      workspaceId,
    );

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);
  });

  it("rejects an empty workspace id", async () => {
    const dependencies = createDependencies();

    const service = new GetKnowledgeDocuments(
      dependencies.unitOfWork,
      dependencies.knowledgeDocumentStore,
    );

    await expect(
      service.execute("   "),
    ).rejects.toThrow("workspaceId is required");

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(0);

    expect(
      dependencies.knowledgeDocumentStore
        .listByWorkspaceId,
    ).not.toHaveBeenCalled();
  });
});
