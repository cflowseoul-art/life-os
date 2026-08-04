/**
 * Schema initialization.
 *
 * The database describes itself in `database/lifeos.sql`, and that file is the
 * only description. Applying it is idempotent — every statement is
 * `CREATE ... IF NOT EXISTS` — so it runs safely on every boot and can be run
 * by hand with the same result.
 *
 * An advisory lock keeps two instances starting at once from racing each other.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "./pool.ts";

/** Any constant works, as long as only this routine uses it. */
const LOCK_ID = 8_150_413;

function schemaSql(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "../../../database/lifeos.sql"), "utf8");
}

/**
 * Brings the database up to the schema. Safe to call repeatedly, and safe to
 * call from several instances at the same time.
 */
export async function ensureSchema(): Promise<void> {
  const client = await db().connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(schemaSql());
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
    client.release();
  }
}
