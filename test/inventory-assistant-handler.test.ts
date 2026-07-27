import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  InventoryAssistantHandler,
} from "../src/application/assistant/inventory-assistant-handler.js";

describe("InventoryAssistantHandler", () => {

  it("returns command response when command succeeds", async () => {
    const inventoryCapability = {
      executeText: vi.fn()
        .mockResolvedValue({
          status: "executed",
          result: {
            intent: "adjust_inventory",
            items: [
              {
                canonicalName: "계란",
                quantity: 0,
                unit: "개",
              },
            ],
          },
        }),
    };

    const handler =
      new InventoryAssistantHandler(
        inventoryCapability as any,
        {} as any,
        {} as any,
        {
          save: vi.fn(),
        } as any,
        {
          save: vi.fn(),
        } as any,
        {
          build: vi.fn(),
        } as any,
      );

    const result =
      await handler.handle({
        text: "계란 다 먹었어",
        workspaceId: "workspace-1",
        householdId: "household-1",
        actorId: "actor-1",
      });

    expect((result as any).message)
      .toBe("계란 0개로 수정했어요.");
  });


  it("falls back when command does not execute", async () => {
    const inventoryCapability = {
      executeText: vi.fn()
        .mockResolvedValue({
          status: "failed",
          reason: "resolve_failed",
        }),

      answerText: vi.fn()
        .mockResolvedValue({
          message: "계란 0개 있어요.",
        }),
    };

    const commandParser = {
      parse: vi.fn()
        .mockResolvedValue({
          intent: null,
          requiresClarification: true,
        }),
    };

    const queryParser = {
      parse: vi.fn()
        .mockResolvedValue({
          intent: "inventory_query",
          productName: "계란",
        }),
    };


    const handler =
      new InventoryAssistantHandler(
        inventoryCapability as any,
        queryParser as any,
        commandParser as any,
        {
          save: vi.fn(),
        } as any,
        {
          save: vi.fn(),
        } as any,
        {
          build: vi.fn(),
        } as any,
      );

    const result =
      await handler.handle({
        text: "계란 몇 개 있어",
        workspaceId: "workspace-1",
        householdId: "household-1",
        actorId: "actor-1",
      });

    expect(result)
      .toBeDefined();

    expect(queryParser.parse)
      .toHaveBeenCalled();
  });

});
