/**
 * `npm run db:init` — apply the schema by hand.
 *
 * The server does this on start; this exists for the times you want to do it
 * separately, or check that it worked.
 */

import "dotenv/config";

import { closeDb } from "./pool.ts";
import { ensureSchema } from "./init.ts";
import { db } from "./pool.ts";

async function main(): Promise<void> {
  await ensureSchema();

  const { rows } = await db().query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'lifeos' ORDER BY 1",
  );

  console.log(`스키마 준비됨: ${rows.map((r) => r.table_name).join(", ")}`);
  await closeDb();
}

void main();
