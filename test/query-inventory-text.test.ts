import { describe, expect, it, vi } from "vitest";

import { QueryInventoryText } from "../src/application/query-inventory-text.js";
import type { GetInventory } from "../src/application/get-inventory.js";

describe("QueryInventoryText", () => {
  it("returns matched inventory by natural language query", async () => {
    const getInventory = {
      execute: vi.fn().mockResolvedValue([
        {
          workspaceId: "workspace-1",
          canonicalProductId: "product-1",
          canonicalName: "계란",
          quantity: 57,
          unit: "개",
          lastVerifiedAt:
            "2026-07-22T00:00:00.000Z",
          sourceType: "explicit_text",
          valueType: "explicit_quantity",
          freshnessStatus: "fresh",
          lastSeq: 1,
        },
      ]),
    } as unknown as GetInventory;

    const service =
      new QueryInventoryText(
        getInventory,
      );

    const result =
      await service.execute({
        text: "계란 몇 개 있어?",
        workspaceId: "workspace-1",
      });

    expect(result).toHaveLength(1);

    expect(result?.[0])
      .toMatchObject({
        canonicalName: "계란",
        quantity: 57,
        unit: "개",
      });
  });


  it("returns empty result when product does not exist", async () => {
    const getInventory = {
      execute: vi.fn().mockResolvedValue([
        {
          workspaceId: "workspace-1",
          canonicalProductId: "product-1",
          canonicalName: "계란",
          quantity: 57,
          unit: "개",
          lastVerifiedAt:
            "2026-07-22T00:00:00.000Z",
          sourceType: "explicit_text",
          valueType: "explicit_quantity",
          freshnessStatus: "fresh",
          lastSeq: 1,
        },
      ]),
    } as unknown as GetInventory;

    const service =
      new QueryInventoryText(
        getInventory,
      );

    const result =
      await service.execute({
        text: "우유 몇 개 있어?",
        workspaceId: "workspace-1",
      });

    expect(result)
      .toEqual([]);
  });
});
