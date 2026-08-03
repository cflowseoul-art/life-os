/**
 * Finance's operating policies.
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
 * 거래유형 (O) is decided when the row is recorded and is the ledger's own
 * word for what this money did. Finance reads it; it does not re-derive it from
 * category names, amounts, or 분류규칙. Where Finance and the ledger could
 * disagree, there is now nothing to disagree with.
 */
export type Flow = "spending" | "transfer" | "income" | "carryover";

export function flowOf(tx: LedgerTransaction): Flow {
  const type = tx.type.trim();

  if (type.includes("이동")) return "transfer";
  // The ledger has no 거래유형 for a carried balance — it records it as 입금
  // with 분류 이월금. 분류 is a ledger field too, so this reads, not infers.
  if (tx.category.trim() === "이월금") return "carryover";
  if (type === "입금" || tx.status.trim() === "입금") return "income";
  if (type === "지출" || tx.status.trim() === "출금") return "spending";

  // Unknown word from the ledger: counted, never silently dropped.
  return "spending";
}

/** Everything Finance evaluates policies against. Read-only. */
export type PolicyContext = {
  transactions: LedgerTransaction[];
  rules: Map<string, CategoryRule>;
  month: string;
  /** LOOKER_KPI figures for the month, as the ledger computed them. */
  kpi?: Record<string, number>;
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
    id: "carryover-zero",
    title: "월초 이월금 0원",
    owner: "finance",
    severity: "high",
    condition: (ctx) => rowsOfFlow(ctx, "carryover").length === 0,
    evidence: (ctx) => asEvidence(rowsOfFlow(ctx, "carryover")),
    template: {
      state: (ctx) => {
        const carried = rowsOfFlow(ctx, "carryover");
        const total = carried.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        return `${ctx.month} 이월금이 ${won(total)} 기록돼 있습니다.`;
      },
      expected: "월초 이월금은 0원이어야 합니다.",
    },
});

financePolicies.register({
    id: "transfers-excluded",
    title: "이동은 통계 제외",
    owner: "finance",
    severity: "medium",
    // The ledger's own per-row 통계포함 (P) is what actually counts.
    condition: (ctx) =>
      ctx.transactions.every(
        (tx) => tx.month !== ctx.month || flowOf(tx) !== "transfer" || !tx.countsInStats,
      ),
    evidence: (ctx) =>
      asEvidence(
        ctx.transactions.filter(
          (tx) => tx.month === ctx.month && flowOf(tx) === "transfer" && tx.countsInStats,
        ),
      ),
    template: {
      state: (ctx) => {
        const wrong = ctx.transactions.filter(
          (tx) => tx.month === ctx.month && flowOf(tx) === "transfer" && tx.countsInStats,
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
    condition: (ctx) => ctx.transactions.every((tx) => tx.month !== ctx.month || tx.category.trim() !== ""),
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

/**
 * 부수입은 투자 가능 금액보다 커야 한다.
 *
 * Both figures are the ledger's: 부수입 is summed from 거래내역 rows the ledger
 * classified as such, and 투자 가능 금액 is LOOKER_KPI's own column. Finance
 * computes neither.
 */
financePolicies.register({
  id: "side-income-over-investable",
  title: "부수입 > 투자 가능 금액",
  severity: "medium",
  condition: (ctx) => {
    const investable = ctx.kpi?.["투자 가능 금액"];
    if (investable === undefined) return true;
    return sideIncome(ctx) > investable;
  },
  evidence: (ctx) => asEvidence(sideIncomeRows(ctx)),
  template: {
    state: (ctx) =>
      `${ctx.month} 부수입은 ${won(sideIncome(ctx))}, 투자 가능 금액은 `
      + `${won(ctx.kpi?.["투자 가능 금액"] ?? 0)}입니다.`,
    expected: "부수입이 투자 가능 금액보다 커야 합니다.",
  },
});

function sideIncomeRows(ctx: PolicyContext): LedgerTransaction[] {
  return ctx.transactions.filter((tx) => tx.month === ctx.month && tx.category.trim() === "부수입");
}

function sideIncome(ctx: PolicyContext): number {
  return sideIncomeRows(ctx).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
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
