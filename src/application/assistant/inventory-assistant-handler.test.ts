import { describe, it, expect, vi } from "vitest";

import { InventoryAssistantHandler } from "./inventory-assistant-handler.js";

describe("InventoryAssistantHandler", () => {
  it("영수증 취소 요청은 query 실패 후 command로 처리된다", async () => {
    const revertLastReceipt = {
      execute: vi.fn().mockResolvedValue({
        message: "마지막 영수증 내역을 취소했어요.",
      }),
    };

    const inventoryCapability = {
      executeText: vi.fn().mockResolvedValue({
        status: "failed",
        reason: "revert_last_receipt_pending",
      }),
      executeCommand: vi.fn(),
      answerText: vi.fn(),
    };

    const queryParser = {
      parse: vi.fn().mockRejectedValue(
        new Error("query parse failed"),
      ),
    };

    const commandParser = {
      parse: vi.fn(),
    };

    const interactionStore = {
      save: vi.fn(),
    };

    const patternStore = {
      find: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };

    const patternCommandBuilder = {
      build: vi.fn(),
    };

    const handler =
      new InventoryAssistantHandler(
        inventoryCapability as any,
        queryParser as any,
        commandParser as any,
        interactionStore as any,
        patternStore as any,
        patternCommandBuilder as any,
        revertLastReceipt as any,
      );

    const result =
      await handler.handle({
        text: "마지막 영수증 취소해줘",
        workspaceId: "test-workspace",
        householdId: "test-household",
        actorId: "test-user",
      });

    expect(
      inventoryCapability.executeText,
    ).toHaveBeenCalled();

    expect(
      revertLastReceipt.execute,
    ).toHaveBeenCalled();

    expect((result as { message: string }).message)
      .toBe("마지막 영수증 내역을 취소했어요.");
  });
});
