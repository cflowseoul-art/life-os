import { describe, expect, it, vi } from "vitest";

import { SaveKnowledgeSource } from "../src/application/save-knowledge-source.js";
import type { KnowledgeSourceStore } from "../src/application/knowledge-source-store.js";
import type {
  Tx,
  UnitOfWork,
} from "../src/application/unit-of-work.js";
import type {
  KnowledgeSource,
  SaveKnowledgeSourceInput,
} from "../src/knowledge/types.js";

const tx: Tx = {};

const workspaceId =
  "11111111-1111-4111-8111-111111111111";

const newSourceId =
  "22222222-2222-4222-8222-222222222222";

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

  const knowledgeSourceStore: KnowledgeSourceStore = {
    save: vi.fn(
      async (
        _tx: Tx,
        source: SaveKnowledgeSourceInput,
      ): Promise<KnowledgeSource> => ({
        ...source,
      }),
    ),
    findById: vi.fn(),
    findByExternalReference: vi.fn(),
    listByWorkspaceId: vi.fn(),
  };

  return {
    unitOfWork,
    knowledgeSourceStore,
    getTransactionCallCount: () =>
      transactionCallCount,
  };
}

describe("SaveKnowledgeSource", () => {
  it("creates a new Apple Notes source", async () => {
    const dependencies = createDependencies();

    vi.mocked(
      dependencies.knowledgeSourceStore
        .findByExternalReference,
    ).mockResolvedValue(null);

    const service = new SaveKnowledgeSource(
      dependencies.unitOfWork,
      dependencies.knowledgeSourceStore,
      () => newSourceId,
      () => "2026-07-22T03:30:00.000Z",
    );

    const result = await service.execute({
      workspaceId,
      sourceType: "apple_notes",
      name: "연서의 Apple Notes",
      externalReference:
        "apple-notes-primary",
    });

    expect(result).toEqual({
      sourceId: newSourceId,
      workspaceId,
      sourceType: "apple_notes",
      name: "연서의 Apple Notes",
      externalReference:
        "apple-notes-primary",
      createdAt: "2026-07-22T03:30:00.000Z",
      updatedAt: "2026-07-22T03:30:00.000Z",
    });

    expect(
      dependencies.knowledgeSourceStore.save,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        sourceId: newSourceId,
        sourceType: "apple_notes",
      }),
    );

    expect(
      dependencies.getTransactionCallCount(),
    ).toBe(1);
  });

  it("updates an existing external source without changing its id", async () => {
    const dependencies = createDependencies();

    const existingSourceId =
      "33333333-3333-4333-8333-333333333333";

    vi.mocked(
      dependencies.knowledgeSourceStore
        .findByExternalReference,
    ).mockResolvedValue({
      sourceId: existingSourceId,
      workspaceId,
      sourceType: "apple_notes",
      name: "기존 이름",
      externalReference:
        "apple-notes-primary",
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    });

    const createId = vi.fn(() => newSourceId);

    const service = new SaveKnowledgeSource(
      dependencies.unitOfWork,
      dependencies.knowledgeSourceStore,
      createId,
      () => "2026-07-22T03:30:00.000Z",
    );

    const result = await service.execute({
      workspaceId,
      sourceType: "apple_notes",
      name: "변경된 Apple Notes 이름",
      externalReference:
        "apple-notes-primary",
    });

    expect(result.sourceId).toBe(
      existingSourceId,
    );

    expect(result.createdAt).toBe(
      "2026-07-20T00:00:00.000Z",
    );

    expect(result.updatedAt).toBe(
      "2026-07-22T03:30:00.000Z",
    );

    expect(createId).not.toHaveBeenCalled();
  });
});
