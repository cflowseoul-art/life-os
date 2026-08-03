/**
 * Finance's operating policies.
 *
 * Finance's question is "돈이 어디에 쓰였는가": spending, savings, investments,
 * income, category and merchant trends, and whether the representative's rules
 * held. It does not model balances, cash timing, or asset state — those belong
 * to Asset Management, and a policy needing them does not belong here.
 *
 * Definitions only. Evaluation, ordering, and suppression of passing rules
 * belong to the company-wide policy engine — Finance is one consumer of it.
 *
 * Finance reports have exactly two purposes: whether the representative's own
 * operating rules are being followed, and changes that deserve their attention.
 * Nothing else — normal activity is not news (Art. 2).
 *
 * Every statement carries its kind:
 *   관찰   read directly from 거래내역, with row numbers
 *   추론   derived by comparison; the derivation is stated
 *   제안   only when the representative asked for one (Art. 6)
 *
 * The ledger stays the source of truth. This module holds no figures of its
 * own and writes nothing.
 */

import { defineRegistry } from "../../company/policy-engine.ts";
import type { PolicyDefinition, Severity, Statement } from "../../company/policy-engine.ts";
import type { CategoryRule, LedgerTransaction } from "../../infrastructure/ledger/dugong.ts";

export type { Severity, Statement };

/**
 * Flow, as the ledger states it.
 *
 * 거래유형 (O), 상태 (K), 통계포함 (P) and 분류 (J) are decided when the row is
 * recorded. Finance reads them and never re-derives them from merchant names,
 * amounts, or 분류규칙.
 */
export type Flow = "spending" | "assetMovement" | "income" | "snapshot";

/** 저축이동 · 투자이동. Money moved, not money used. */
const ASSET_MOVEMENT_CATEGORIES = ["저축이동", "투자이동"];

/**
 * A balance snapshot, identified only by ledger fields — never by merchant name
 * or amount. Snapshots belong to Asset Management; Finance ignores them.
 */
export function isSnapshot(tx: LedgerTransaction): boolean {
  return tx.type.trim() === "스냅샷" || tx.status.trim() === "스냅샷" || !tx.countsInStats;
}

export function flowOf(tx: LedgerTransaction): Flow {
  if (isSnapshot(tx)) return "snapshot";
  if (ASSET_MOVEMENT_CATEGORIES.includes(tx.category.trim())) return "assetMovement";
  if (tx.type.trim() === "입금") return "income";

  return "spending";
}

/** Everything Finance evaluates policies against. Read-only. */
export type PolicyContext = {
  transactions: LedgerTransaction[];
  rules: Map<string, CategoryRule>;
  month: string;
};

/** Finance's registry. The engine owns evaluation; Finance owns the rules. */
export const financePolicies = defineRegistry<PolicyContext>("finance");

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** Rows of a given flow in the month under review. */
function rowsOfFlow(context: PolicyContext, flow: Flow): LedgerTransaction[] {
  // 기준월 (R) is the ledger's month, not one sliced off the date.
  return context.transactions.filter((tx) => tx.month === context.month && flowOf(tx) === flow);
}

function asEvidence(transactions: LedgerTransaction[], limit = 5): Statement[] {
  return transactions.slice(0, limit).map((tx) => ({
    kind: "관찰" as const,
    text: `${tx.date} · ${tx.description} · ${won(Math.abs(tx.amount))}`,
    rows: [tx.row],
  }));
}

/** Every operating rule the representative has set for money, as data. */
financePolicies.register({
    id: "transfers-excluded",
    title: "이동은 통계 제외",
    owner: "finance",
    severity: "medium",
    // The ledger's own per-row 통계포함 (P) is what actually counts.
    condition: (ctx) =>
      ctx.transactions.every(
        (tx) => tx.month !== ctx.month || flowOf(tx) !== "assetMovement" || !tx.countsInStats,
      ),
    evidence: (ctx) =>
      asEvidence(
        ctx.transactions.filter(
          (tx) => tx.month === ctx.month && flowOf(tx) === "assetMovement" && tx.countsInStats,
        ),
      ),
    template: {
      state: (ctx) => {
        const wrong = ctx.transactions.filter(
          (tx) => tx.month === ctx.month && flowOf(tx) === "assetMovement" && tx.countsInStats,
        );
        return `이동 거래 ${String(wrong.length)}건이 통계포함 Y로 기록돼 있습니다.`;
      },
      expected: "저축·투자·카드대금 이동은 통계에서 제외돼야 합니다.",
    },
});

financePolicies.register({
    id: "rows-classified",
    title: "분류 누락 없음",
    owner: "finance",
    severity: "low",
    condition: (ctx) =>
      ctx.transactions.every(
        (tx) => tx.month !== ctx.month || isSnapshot(tx) || tx.category.trim() !== "",
      ),
    evidence: (ctx) =>
      asEvidence(ctx.transactions.filter((tx) => tx.month === ctx.month && tx.category.trim() === "")),
    template: {
      state: (ctx) => {
        const blank = ctx.transactions.filter(
          (tx) => tx.month === ctx.month && tx.category.trim() === "",
        );
        return `${ctx.month} 거래 중 ${String(blank.length)}건에 분류가 비어 있습니다.`;
      },
      expected: "모든 거래에 분류가 있어야 합니다.",
    },
});

/** Only the rules that are not being followed. Evaluation lives in the engine. */
export function violations(context: PolicyContext) {
  return financePolicies.evaluate(context);
}

export const ALL_POLICIES_PASS = "대표님께서 설정하신 운영 기준은 모두 정상입니다.";

/**
 * Whether the representative asked for a recommendation.
 *
 * Absent an explicit request, Finance reports and stops. It does not suggest,
 * and it never acts.
 */
export function recommendationRequested(text: string): boolean {
  return /추천|제안|어떻게\s*할까|어떻게\s*하면|의견|조언|골라/.test(text);
}
