import type {
  Pool,
} from "pg";

import type {
  ProductCreator,
  CreatedProduct,
} from "../../application/product-creator.js";

export class PostgresProductCreator
  implements ProductCreator
{
  constructor(
    private readonly pool: Pick<Pool, "query">,
  ) {}

  async create(input: {
    name: string;
    baseUnit: string;
  }): Promise<CreatedProduct> {

    const productId =
      crypto.randomUUID();

    await this.pool.query(
      `
      INSERT INTO products (
        id,
        canonical_name,
        base_unit
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (canonical_name)
      DO NOTHING
      `,
      [
        productId,
        input.name,
        input.baseUnit,
      ],
    );

    const product =
      await this.pool.query<{
        id: string;
        canonical_name: string;
      }>(
        `
        SELECT
          id,
          canonical_name
        FROM products
        WHERE canonical_name = $1
        `,
        [
          input.name,
        ],
      );

    const row =
      product.rows[0];

    if (!row) {
      throw new Error(
        "Product creation failed",
      );
    }

    await this.pool.query(
      `
      INSERT INTO product_aliases (
        alias,
        canonical_product_id
      )
      VALUES ($1, $2)
      ON CONFLICT (alias)
      DO NOTHING
      `,
      [
        input.name,
        row.id,
      ],
    );

    return {
      canonicalProductId:
        row.id,

      canonicalName:
        row.canonical_name,
    };
  }
}
