/**
 * Asset execution.
 *
 * Reads state that a source recorded, reports it, and stops. It never sums
 * transactions into a balance, never calls a balance "available", and never
 * proposes anything.
 *
 * Structural boundary (§9): the types below carry balances and nothing about
 * spending. `AssetReport` cannot express a category anomaly or a fixed-cost
 * figure, and Finance's report cannot express a balance — the compiler holds
 * the line, not a comment.
 */

import { EventLog } from "../events/log.ts";
import type { Forbidden, ForbiddenForAsset } from "./boundaries.ts";
import { assetPolicies } from "../capabilities/asset/policy.ts";
import { typeFromSource } from "../capabilities/asset/snapshot.ts";
import type { AssetSnapshot, PendingAsset } from "../capabilities/asset/snapshot.ts";
import { readBalanceRows, readPendingAssetRows } from "../infrastructure/ledger/dugong.ts";

/** What Asset may say. No spending or capacity concepts exist in this shape. */
export type AssetReport = Forbidden<ForbiddenForAsset> & {
  asOf: string;
  observations: { text: string; evidence: string }[];
  /** The most recent snapshot per account — what is held now. */
  current: AssetSnapshot[];
  /** Every snapshot read, oldest included. History, not state. */
  snapshots: AssetSnapshot[];
  pending: PendingAsset[];
  violations: string[];
};

function normaliseDate(raw: string): string {
  const m = /(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/.exec(raw);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : raw.trim();
}

function number(raw: string): number {
  return Number((raw ?? "").replace(/[^\d.-]/g, ""));
}

/** 잔액기록 rows → snapshots. Type comes from the source, or "other". */
export function parseBalances(rows: string[][]): AssetSnapshot[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const at = {
    asOf: headers.indexOf("기록일"),
    name: headers.indexOf("계좌"),
    amount: headers.indexOf("잔액"),
    source: headers.indexOf("수집원"),
    related: headers.indexOf("관련거래ID"),
    note: headers.indexOf("메모"),
    type: headers.indexOf("자산형태"),
  };

  if (at.asOf === -1 || at.amount === -1) return [];

  return rows.slice(1).flatMap((cells, index) => {
    const name = at.name === -1 ? "" : (cells[at.name] ?? "").trim();
    const amount = number(cells[at.amount] ?? "");
    if (name === "" || Number.isNaN(amount)) return [];

    return [{
      asOf: normaliseDate(cells[at.asOf] ?? ""),
      name,
      // 잔액기록 states no 자산형태 today, so the type stays "other".
      type: typeFromSource(at.type === -1 ? undefined : cells[at.type]),
      amount,
      source: "잔액기록",
      evidence: `잔액기록 ${String(index + 2)}행`,
      relatedTransactionKey: at.related === -1 ? undefined : (cells[at.related] ?? "").trim() || undefined,
      note: at.note === -1 ? undefined : (cells[at.note] ?? "").trim() || undefined,
    }];
  });
}

/** PENDING_ASSET rows → pending assets, as written. */
export function parsePending(rows: string[][]): PendingAsset[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const col = (name: string) => headers.indexOf(name);

  return rows.slice(1).flatMap((cells, index) => {
    const id = (cells[col("ID")] ?? "").trim();
    if (id === "") return [];

    const expected = number(cells[col("예상가치")] ?? "");
    const received = number(cells[col("실제수령가치")] ?? "");

    return [{
      id,
      title: (cells[col("제목")] ?? "").trim(),
      kind: (cells[col("유형")] ?? "").trim(),
      expectedValue: Number.isNaN(expected) ? null : expected,
      receivedValue: Number.isNaN(received) ? null : received,
      status: (cells[col("상태")] ?? "").trim(),
      form: (cells[col("자산형태")] ?? "").trim(),
      expectedOn: (cells[col("예정수령일")] ?? "").trim(),
      source: "PENDING_ASSET",
      evidence: `PENDING_ASSET ${String(index + 2)}행`,
    }];
  });
}

/**
 * Reads what is currently owned or owed, as recorded.
 *
 * Every line is 관찰. A balance is stated as a balance — never as available,
 * free, investable, or safe-to-spend cash, because no policy says it is.
 */
export async function readAssetState(): Promise<AssetReport> {
  const snapshots = parseBalances(await readBalanceRows());
  const pending = parsePending(await readPendingAssetRows());
  const failed = assetPolicies.evaluate({ snapshots });

  const latestByAccount = new Map<string, AssetSnapshot>();
  for (const s of snapshots) {
    const held = latestByAccount.get(s.name);
    if (!held || s.asOf > held.asOf) latestByAccount.set(s.name, s);
  }

  const observations = [...latestByAccount.values()].map((s) => ({
    text: `${s.asOf} 기준 ${s.name} 잔액은 ${s.amount.toLocaleString("ko-KR")}원입니다.`,
    evidence: s.evidence,
  }));

  return {
    asOf: [...latestByAccount.values()].map((s) => s.asOf).sort().at(-1) ?? "",
    observations,
    current: [...latestByAccount.values()],
    snapshots,
    pending,
    violations: failed.map((f) => f.state.text),
  };
}

/** Records Asset's own reading. Read-only against every source. */
export function recordAssetReport(log: EventLog, report: AssetReport): void {
  void log;
  void report;
}
