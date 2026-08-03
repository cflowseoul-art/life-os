/**
 * Treasury execution.
 *
 * Asks Finance and Asset for their conclusions, calculates capacity, and
 * reports. It never reads 거래내역, never computes a balance, and has no way to
 * recommend or allocate anything — how much to invest is the representative's
 * decision (Art. 6).
 *
 * Note what this file does *not* import: no dugong adapter, no ledger types.
 */

import { EventLog } from "../events/log.ts";
import { conclude } from "../capabilities/treasury/capacity.ts";
import type { TreasuryConclusion, TreasuryInput, TreasuryPolicySet } from "../capabilities/treasury/input.ts";
import { financeConclusion } from "./finance-runner.ts";
import { readAssetState } from "./asset-runner.ts";

/**
 * The representative's rules.
 *
 * Nothing is set, and nothing is defaulted. Treasury stays quiet about anything
 * a rule would be needed for until they set one.
 */
export function treasuryPolicy(): TreasuryPolicySet {
  return {};
}

/** Collects both departments' conclusions and calculates from those alone. */
export async function readTreasuryState(month: string, now = new Date()): Promise<TreasuryConclusion> {
  const finance = await financeConclusion(month);
  const asset = await readAssetState();

  const input: TreasuryInput = {
    asOf: now.toISOString().slice(0, 10),
    finance,
    asset: {
      asOf: asset.asOf,
      // Quoted from Asset, with its evidence attached. Never recomputed.
      // The current balance per account, not the history of snapshots.
      balances: asset.current
        .filter((s) => s.type !== "liability")
        .map((s) => ({ name: s.name, amount: s.amount, asOf: s.asOf, evidence: s.evidence })),
      liabilities: asset.current
        .filter((s) => s.type === "liability")
        .map((s) => ({ name: s.name, amount: s.amount, asOf: s.asOf, evidence: s.evidence })),
    },
    policy: treasuryPolicy(),
  };

  return conclude(input);
}

/** Reserved for the day Treasury reports into the desk stream. */
export function recordTreasuryReport(log: EventLog, conclusion: TreasuryConclusion): void {
  void log;
  void conclusion;
}
