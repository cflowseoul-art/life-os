import type {
  Pool,
} from "pg";

import type {
  ProductResolver,
  ResolvedProduct,
} from "../../application/product-resolver.js";

type ProductRow = {
  canonicalProductId: string;
  canonicalName: string;
};

export class PostgresProductResolver
  implements ProductResolver
{
  constructor(
    private readonly pool: Pick<Pool, "query">,
  ) {}

  async resolve(
    rawName: string,
  ): Promise<ResolvedProduct | null> {
    const result =
      await this.pool.query<ProductRow>(
        `
          SELECT
            p.id AS "canonicalProductId",
            p.canonical_name AS "canonicalName"
          FROM product_aliases pa
          JOIN products p
            ON p.id = pa.canonical_product_id
          WHERE pa.alias = $1
          LIMIT 1
        `,
        [
          rawName,
        ],
      );

    const row =
      result.rows[0];

    if (!row) {
      return null;
    }

    return {
      canonicalProductId:
        row.canonicalProductId,
      canonicalName:
        row.canonicalName,
    };
  }
}
