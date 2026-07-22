import type {
  InventoryQueryParser,
} from "../src/household-supplies/parser/inventory-query-parser.js";

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
        {
          parse: vi.fn().mockResolvedValue({
            intent: "inventory_query",
            targetPlugin: "household-supplies",
            workspaceId: "workspace-1",
            productName: "계란",
            confidence: 1,
            requiresClarification: false,
          }),
        } as InventoryQueryParser,
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
        {
          parse: vi.fn().mockResolvedValue({
            intent: "inventory_query",
            targetPlugin: "household-supplies",
            workspaceId: "workspace-1",
            productName: "우유",
            confidence: 1,
            requiresClarification: false,
          }),
        } as InventoryQueryParser,
      );

    const result =
      await service.execute({
        text: "우유 몇 개 있어?",
        workspaceId: "workspace-1",
      });

    expect(result)
      .toEqual([]);
  });
  it("returns all inventory for inventory list query", async () => {
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
        {
          workspaceId: "workspace-1",
          canonicalProductId: "product-2",
          canonicalName: "우유",
          quantity: 2,
          unit: "개",
          lastVerifiedAt:
            "2026-07-22T00:00:00.000Z",
          sourceType: "explicit_text",
          valueType: "explicit_quantity",
          freshnessStatus: "fresh",
          lastSeq: 2,
        },
      ]),
    } as unknown as GetInventory;

    const service =
      new QueryInventoryText(
        getInventory,
        {
          parse: vi.fn().mockResolvedValue({
            intent: "inventory_list",
            targetPlugin: "household-supplies",
            workspaceId: "workspace-1",
            productName: null,
            confidence: 1,
            requiresClarification: false,
          }),
        } as InventoryQueryParser,
      );

    const result =
      await service.execute({
        text: "냉장고 뭐 있어?",
        workspaceId: "workspace-1",
      });

    expect(result)
      .toHaveLength(2);

    expect(result)
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            canonicalName: "계란",
            quantity: 57,
          }),
          expect.objectContaining({
            canonicalName: "우유",
            quantity: 2,
          }),
        ]),
      );
  });


});
