import type { Tx } from "./unit-of-work.js";

export interface UnitConversionResolver {
  resolve(
    tx: Tx,
    input: {
      canonicalProductId: string;
      fromUnit: string;
    },
  ): Promise<number | null>;
}
