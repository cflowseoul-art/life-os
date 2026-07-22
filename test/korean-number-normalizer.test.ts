import { describe, expect, it } from "vitest";

import { KoreanNumberNormalizer } from "../src/household-supplies/parser/normalizers/korean-number-normalizer.js";

describe("KoreanNumberNormalizer", () => {
  const normalizer =
    new KoreanNumberNormalizer();

  it("normalizes korean numbers before unit", () => {
    expect(
      normalizer.normalize(
        "계란 두 개 먹었어",
      ),
    )
      .toBe(
        "계란 2개 먹었어",
      );

    expect(
      normalizer.normalize(
        "계란 한 판 샀어",
      ),
    )
      .toBe(
        "계란 1판 샀어",
      );
  });

  it("does not change unrelated words", () => {
    expect(
      normalizer.normalize(
        "한우 샀어",
      ),
    )
      .toBe(
        "한우 샀어",
      );
  });
});
