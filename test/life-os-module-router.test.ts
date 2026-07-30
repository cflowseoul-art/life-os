import { describe, expect, it, vi } from "vitest";

import {
  LifeOsModuleRouter,
  type InventoryReader,
  type KnowledgeDocumentReader,
} from "../src/application/life-os-module-router.js";

const workspaceId =
  "11111111-1111-4111-8111-111111111111";

function createDependencies() {
  const inventoryReader: InventoryReader = {
    execute: vi.fn(),
  };

  const knowledgeDocumentReader:
    KnowledgeDocumentReader = {
      execute: vi.fn(),
    };

  return {
    inventoryReader,
    knowledgeDocumentReader,
  };
}

describe("LifeOsModuleRouter", () => {
  it("routes inventory list requests", async () => {
    const dependencies = createDependencies();

    const inventory = [
      {
        workspaceId,
        canonicalProductId:
          "22222222-2222-4222-8222-222222222222",
        canonicalName: "계란",
        quantity: 30,
        unit: "개",
        lastVerifiedAt:
          "2026-07-22T03:00:00.000Z",
        sourceType: "explicit_text" as const,
        valueType:
          "explicit_quantity" as const,
        freshnessStatus: "fresh" as const,
        label: "NEW" as const,
        lastSeq: 1,
      },
    ];

    vi.mocked(
      dependencies.inventoryReader.execute,
    ).mockResolvedValue(inventory);

    const router = new LifeOsModuleRouter(
      dependencies.inventoryReader,
      dependencies.knowledgeDocumentReader,
    );

    const result = await router.route({
      module: "inventory",
      action: "list",
      workspaceId,
    });

    expect(result).toEqual({
      module: "inventory",
      action: "list",
      data: inventory,
    });

    expect(
      dependencies.inventoryReader.execute,
    ).toHaveBeenCalledWith(workspaceId);

    expect(
      dependencies.knowledgeDocumentReader.execute,
    ).not.toHaveBeenCalled();
  });

  it("routes knowledge list requests", async () => {
    const dependencies = createDependencies();

    const documents = [
      {
        documentId:
          "33333333-3333-4333-8333-333333333333",
        workspaceId,
        sourceId:
          "44444444-4444-4444-8444-444444444444",
        externalId: "apple-note-001",
        folderPath: "Life OS",
        title: "Life OS 설계",
        content: "설계 내용",
        sourceCreatedAt: null,
        sourceUpdatedAt: null,
        importedAt:
          "2026-07-22T03:00:00.000Z",
        contentHash: "hash",
        status: "active" as const,
      },
    ];

    vi.mocked(
      dependencies.knowledgeDocumentReader.execute,
    ).mockResolvedValue(documents);

    const router = new LifeOsModuleRouter(
      dependencies.inventoryReader,
      dependencies.knowledgeDocumentReader,
    );

    const result = await router.route({
      module: "knowledge",
      action: "list",
      workspaceId,
    });

    expect(result).toEqual({
      module: "knowledge",
      action: "list",
      data: documents,
    });

    expect(
      dependencies.knowledgeDocumentReader.execute,
    ).toHaveBeenCalledWith(workspaceId);

    expect(
      dependencies.inventoryReader.execute,
    ).not.toHaveBeenCalled();
  });
});
