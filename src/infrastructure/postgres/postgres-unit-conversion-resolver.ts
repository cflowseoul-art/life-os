import type { Pool } from "pg";

import type {
  UnitConversionResolver,
} from "../../application/unit-conversion-resolver.js";

import type {
  Tx,
} from "../../application/unit-of-work.js";

type UnitConversionRow = {
  toBaseFactor: number;
};

export class PostgresUnitConversionResolver
  implements UnitConversionResolver
{
  constructor(
    private readonly pool: Pick<Pool, "query">,
  ) {}

  async resolve(
    _tx: Tx,
    input: {
      canonicalProductId: string;
      fromUnit: string;
    },
  ): Promise<number | null> {
    const result =
      await this.pool.query<UnitConversionRow>(
        `
          SELECT
            to_base_factor AS "toBaseFactor"
          FROM unit_conversions
          WHERE canonical_product_id = $1
            AND from_unit = $2
          LIMIT 1
        `,
        [
          input.canonicalProductId,
          input.fromUnit,
        ],
      );

    const row =
      result.rows[0];

    if (!row) {
      return null;
    }

    return Number(row.toBaseFactor);
  }
}
