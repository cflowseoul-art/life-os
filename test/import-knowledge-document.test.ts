import { describe, expect, it, vi } from "vitest";

import { ImportKnowledgeDocument } from "../src/application/import-knowledge-document.js";
import type { KnowledgeDocumentStore } from "../src/application/knowledge-document-store.js";
import type {
  Tx,
  UnitOfWork,
} from "../src/application/unit-of-work.js";
import type {
  KnowledgeDocument,
  SaveKnowledgeDocumentInput,
} from "../src/knowledge/types.js";

const tx: Tx = {};

const workspaceId =
  "11111111-1111-4111-8111-111111111111";

const sourceId =
  "22222222-2222-4222-8222-222222222222";

const newDocumentId =
  "33333333-3333-4333-8333-333333333333";

function createStoredDocument(
  input: SaveKnowledgeDocumentInput,
): KnowledgeDocument {
  return {
    ...input,
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
    save: vi.fn(
      async (
        _tx: Tx,
        document: SaveKnowledgeDocumentInput,
      ) => createStoredDocument(document),
    ),
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

describe("ImportKnowledgeDocument", () => {
  it("imports a new external knowledge document", async () => {
    const dependencies = createDependencies();

    vi.mocked(
      dependencies.knowledgeDocumentStore
        .findByExternalId,
    ).mockResolvedValue(null);

    const service = new ImportKnowledgeDocument(
      dependencies.unitOfWork,
      dependencies.knowledgeDocumentStore,
      () => newDocumentId,
      () => "2026-07-22T03:20:00.000Z",
      () => "fixed-content-hash",
    );

    const result = await service.capture({
      workspaceId,
      sourceId,
      externalId: "apple-note-001",
      folderPath: "데이터분석/로그 설계",
      title: "이벤트 로그 설계",
      content: "이벤트와 상태값을 분리한다.",
      sourceCreatedAt:
        "2026-07-20T10:00:00.000Z",
      sourceUpdatedAt:
        "2026-07-21T10:00:00.000Z",
    });

    expect(result).toEqual({
      documentId: newDocumentId,
      workspaceId,
      sourceId,
      externalId: "apple-note-001",
      folderPath: "데이터분석/로그 설계",
      title: "이벤트 로그 설계",
      content: "이벤트와 상태값을 분리한다.",
      sourceCreatedAt:
        "2026-07-20T10:00:00.000Z",
      sourceUpdatedAt:
        "2026-07-21T10:00:00.000Z",
      importedAt: "2026-07-22T03:20:00.000Z",
      contentHash: "fixed-content-hash",
      status: "active",
    });

    expect(
      dependencies.knowledgeDocumentStore
        .findByExternalId,
    ).toHaveBeenCalledWith(
      tx,
      workspaceId,
      sourceId,
      "apple-note-001",
    );

    expect(
      dependencies.knowledgeDocumentStore.save,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        documentId: newDocumentId,
        contentHash: "fixed-content-hash",
      }),
    );

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);
  });

  it("keeps the existing document id when reimporting", async () => {
    const dependencies = createDependencies();

    const existingDocumentId =
      "44444444-4444-4444-8444-444444444444";

    vi.mocked(
      dependencies.knowledgeDocumentStore
        .findByExternalId,
    ).mockResolvedValue({
      documentId: existingDocumentId,
      workspaceId,
      sourceId,
      externalId: "apple-note-001",
      folderPath: "이전 폴더",
      title: "이전 제목",
      content: "이전 내용",
      sourceCreatedAt: null,
      sourceUpdatedAt: null,
      importedAt: "2026-07-21T00:00:00.000Z",
      contentHash: "old-hash",
      status: "active",
    });

    const createId = vi.fn(() => newDocumentId);

    const service = new ImportKnowledgeDocument(
      dependencies.unitOfWork,
      dependencies.knowledgeDocumentStore,
      createId,
      () => "2026-07-22T03:20:00.000Z",
      () => "new-hash",
    );

    const result = await service.capture({
      workspaceId,
      sourceId,
      externalId: "apple-note-001",
      folderPath: "새 폴더",
      title: "새 제목",
      content: "새 내용",
      sourceCreatedAt: null,
      sourceUpdatedAt:
        "2026-07-22T02:00:00.000Z",
    });

    expect(result.documentId).toBe(
      existingDocumentId,
    );

    expect(result.content).toBe("새 내용");
    expect(result.contentHash).toBe("new-hash");
    expect(createId).not.toHaveBeenCalled();
  });

  it("does not search by external id for manual documents", async () => {
    const dependencies = createDependencies();

    const service = new ImportKnowledgeDocument(
      dependencies.unitOfWork,
      dependencies.knowledgeDocumentStore,
      () => newDocumentId,
      () => "2026-07-22T03:20:00.000Z",
      () => "manual-hash",
    );

    await service.capture({
      workspaceId,
      sourceId,
      externalId: null,
      folderPath: null,
      title: "직접 작성한 메모",
      content: "Life OS에 직접 저장한 내용",
      sourceCreatedAt: null,
      sourceUpdatedAt: null,
    });

    expect(
      dependencies.knowledgeDocumentStore
        .findByExternalId,
    ).not.toHaveBeenCalled();

    expect(
      dependencies.knowledgeDocumentStore.save,
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects empty document content before opening a transaction", async () => {
    const dependencies = createDependencies();

    const service = new ImportKnowledgeDocument(
      dependencies.unitOfWork,
      dependencies.knowledgeDocumentStore,
    );

    await expect(
      service.capture({
        workspaceId,
        sourceId,
        externalId: "apple-note-002",
        folderPath: "스크랩",
        title: "빈 메모",
        content: "   ",
        sourceCreatedAt: null,
        sourceUpdatedAt: null,
      }),
    ).rejects.toThrow("content is required");

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(0);

    expect(
      dependencies.knowledgeDocumentStore.save,
    ).not.toHaveBeenCalled();
  });
});
