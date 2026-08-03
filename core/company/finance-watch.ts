/**
 * Scheduled policy checks.
 *
 * Two triggers, and no others: the turn of a month, and the ledger changing.
 * Time passing is not a reason to speak; a rule being broken is (Art. 2).
 *
 * A violation is reported once. While it stays unresolved, it is not raised
 * again — the representative is told a thing is wrong, not reminded of it
 * (Art. 1). When it clears and later recurs, that is a new fact and is
 * reported again.
 *
 * Read-only: the ledger is read, never written, and nothing here acts.
 */

import { randomUUID } from "node:crypto";

import { EventLog } from "../events/log.ts";
import { violations } from "../capabilities/finance/policy.ts";
import { readCategoryRules, readLedger } from "../infrastructure/ledger/dugong.ts";
import { advanceFinanceFromLedger } from "./finance-runner.ts";

/** What the ledger looked like, cheaply. Changes when any row does. */
function fingerprint(rows: { row: number; key: string; amount: number; month: string }[]): string {
  return `${String(rows.length)}:${rows.map((r) => `${r.key || String(r.row)}#${String(r.amount)}`).join(",").length.toString(36)}:${rows.at(-1)?.month ?? ""}`;
}

/** Violations already reported and not yet seen to clear. */
function openSignatures(log: EventLog): Set<string> {
  const open = new Set<string>();

  for (const envelope of log.read()) {
    const { event } = envelope;
    if (event.type !== "HandedOver" || event.capability !== "finance") continue;

    const match = /^정책점검 (.+)$/.exec(event.handover.company);
    if (match) for (const sig of match[1].split(" ")) open.add(sig);
  }

  return open;
}

export type WatchResult = {
  ran: boolean;
  reason: "month-start" | "ledger-changed" | "none";
  reported: string[];
  suppressed: string[];
};

let lastFingerprint: string | null = null;
let lastMonthChecked: string | null = null;

/**
 * Runs a check if a trigger fired. Returns what happened, for inspection only.
 */
export async function checkFinancePolicies(log: EventLog, now = new Date()): Promise<WatchResult> {
  const read = await readLedger();
  if (!read.ok) return { ran: false, reason: "none", reported: [], suppressed: [] };

  const month = now.toISOString().slice(0, 7);
  const print = fingerprint(read.transactions);

  const monthStart = now.getDate() === 1 && lastMonthChecked !== month;
  const changed = lastFingerprint !== null && lastFingerprint !== print;

  lastFingerprint = print;
  if (monthStart) lastMonthChecked = month;

  if (!monthStart && !changed) return { ran: false, reason: "none", reported: [], suppressed: [] };

  const rules = await readCategoryRules();
  const failed = violations({ transactions: read.transactions, rules, month });

  const open = openSignatures(log);
  const signatures = failed.map((f) => `${f.policy.id}@${month}`);
  const fresh = signatures.filter((s) => !open.has(s));
  const suppressed = signatures.filter((s) => open.has(s));

  if (fresh.length > 0) {
    // One report for whatever is newly wrong. The department reports; it does
    // not act, and it proposes nothing.
    log.append(
      {
        type: "HandedOver",
        holdId: randomUUID(),
        capability: "finance",
        handover: {
          company: `정책점검 ${fresh.join(" ")}`,
          role: `${month} 운영 기준 점검`,
          jdText: `${month} 정기 점검`,
        },
      },
      { kind: "capability", id: "finance" },
      "finance",
      monthStart ? "schedule:month-start" : "schedule:ledger-changed",
    );

    await advanceFinanceFromLedger(log, now);
  }

  return {
    ran: true,
    reason: monthStart ? "month-start" : "ledger-changed",
    reported: fresh,
    suppressed,
  };
}

/** Polls for the two triggers. The interval itself is never a trigger. */
export function startFinanceSchedule(log: EventLog, everyMs = 15 * 60_000): () => void {
  void checkFinancePolicies(log);
  const timer = setInterval(() => { void checkFinancePolicies(log); }, everyMs);
  timer.unref();
  return () => { clearInterval(timer); };
}
