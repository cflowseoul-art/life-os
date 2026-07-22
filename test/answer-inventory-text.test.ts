import { describe, expect, it, vi } from "vitest";

import {
  AnswerInventoryText,
} from "../src/application/answer-inventory-text.js";

import type {
  QueryInventoryText,
} from "../src/application/query-inventory-text.js";

describe("AnswerInventoryText", () => {
  it("converts inventory query result into human answer", async () => {
    const queryInventoryText = {
      execute: vi.fn()
        .mockResolvedValue([
          {
            canonicalName: "계란",
            quantity: 57,
            unit: "개",
          },
        ]),
    } as unknown as QueryInventoryText;

    const service =
      new AnswerInventoryText(
        queryInventoryText,
      );

    const result =
      await service.execute({
        text: "계란 몇 개 있어?",
        workspaceId: "workspace-1",
      });

    expect(result?.message)
      .toBe("계란 57개 있어요.");

    expect(result?.items)
      .toHaveLength(1);
  });


  it("returns null when query cannot be resolved", async () => {
    const queryInventoryText = {
      execute: vi.fn()
        .mockResolvedValue(null),
    } as unknown as QueryInventoryText;

    const service =
      new AnswerInventoryText(
        queryInventoryText,
      );

    const result =
      await service.execute({
        text: "오늘 뭐 먹지?",
        workspaceId: "workspace-1",
      });

    expect(result)
      .toBeNull();
  });
});
