/**
 * Connection check. Reads the latest transactions and prints them.
 *
 * Read-only, like everything in this directory. Prints no credential values.
 */

import "dotenv/config";

import { readLedger } from "./dugong.ts";

const result = await readLedger();

if (!result.ok) {
  console.error(result.reason);
  process.exit(1);
}

const latest = [...result.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

console.log(`${result.source} · ${String(result.transactions.length)}건`);

for (const tx of latest) {
  console.log(
    `  ${tx.date}  ${tx.description.padEnd(16)} ${tx.category.padEnd(8)} `
    + `${tx.amount.toLocaleString("ko-KR").padStart(12)}원  (${String(tx.row)}행)`,
  );
}
