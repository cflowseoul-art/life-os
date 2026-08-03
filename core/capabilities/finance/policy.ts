/**
 * Operating policy checks.
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

import type { CategoryRule, LedgerTransaction } from "../../infrastructure/ledger/dugong.ts";

/**
 * The ledger's own vocabulary.
 *
 * 분류규칙 states 거래유형 for the categories it covers. The names below are the
 * ledger's reserved category names for the flows it does not rule on — they are
 * read as written, not inferred from amounts or patterns.
 */
const INCOME_CATEGORIES = ["월급", "부수입"];
const CARRYOVER_CATEGORIES = ["이월금"];

export type Flow = "spending" | "transfer" | "income" | "carryover";

export function flowOf(tx: LedgerTransaction, rules: Map<string, CategoryRule>): Flow {
  const category = tx.category.trim();

  if (CARRYOVER_CATEGORIES.includes(category)) return "carryover";
  if (INCOME_CATEGORIES.includes(category)) return "income";

  const rule = rules.get(category);
  if (rule && !rule.countsAsSpending) return "transfer";

  return "spending";
}

export type Statement = {
  kind: "관찰" | "추론" | "제안";
  text: string;
  /** 거래내역 rows behind it. Empty only for a 제안 the representative asked for. */
  rows: number[];
};

export type PolicyFinding = {
  policy: string;
  /** What the ledger currently shows. */
  state: Statement;
  /** The rule as the representative set it. */
  expected: string;
  /** The rows that demonstrate it. */
  evidence: Statement[];
};

export type Policy = {
  id: string;
  /** Stated as the representative's rule, not as our opinion. */
  expected: string;
  check(
    transactions: LedgerTransaction[],
    rules: Map<string, CategoryRule>,
    month: string,
  ): PolicyFinding | null;
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 월초 이월금은 0이어야 한다.
 *
 * A carried balance at the start of a month means the previous month did not
 * close out. The check states what is there and what the rule says, and stops.
 */
export const carryoverIsZero: Policy = {
  id: "carryover-zero",
  expected: "월초 이월금은 0원이어야 합니다.",
  check(transactions, rules, month) {
    const carried = transactions.filter(
      (tx) => tx.date.startsWith(month) && flowOf(tx, rules) === "carryover",
    );

    const total = carried.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    if (total === 0) return null;

    return {
      policy: "월초 이월금 0원",
      state: {
        kind: "관찰",
        text: `${month} 이월금이 ${won(total)} 기록돼 있습니다.`,
        rows: carried.map((tx) => tx.row),
      },
      expected: "월초 이월금은 0원이어야 합니다.",
      evidence: carried.map((tx) => ({
        kind: "관찰" as const,
        text: `${tx.date} · ${tx.description} · ${won(Math.abs(tx.amount))}`,
        rows: [tx.row],
      })),
    };
  },
};

/**
 * 이동은 통계에 잡히지 않아야 한다.
 *
 * If a transfer category is marked 통계포함 Y in 분류규칙, spending figures are
 * inflated by money that only moved. The ledger's own rules are the evidence.
 */
export const transfersExcluded: Policy = {
  id: "transfers-excluded",
  expected: "저축·투자·카드대금 이동은 통계에서 제외돼야 합니다.",
  check(transactions, rules, month) {
    const wrong = [...rules.values()].filter(
      (r) => r.type.includes("이동") && r.countsAsSpending,
    );

    if (wrong.length === 0) return null;

    const affected = transactions.filter(
      (tx) => tx.date.startsWith(month) && wrong.some((r) => r.category === tx.category.trim()),
    );

    return {
      policy: "이동은 통계 제외",
      state: {
        kind: "관찰",
        text: `분류규칙에서 ${wrong.map((r) => r.category).join(", ")}가 통계포함 Y로 돼 있습니다.`,
        rows: affected.map((tx) => tx.row),
      },
      expected: "저축·투자·카드대금 이동은 통계에서 제외돼야 합니다.",
      evidence: affected.map((tx) => ({
        kind: "관찰" as const,
        text: `${tx.date} · ${tx.description} · ${won(Math.abs(tx.amount))}`,
        rows: [tx.row],
      })),
    };
  },
};

/**
 * 분류가 비어 있으면 통계가 흔들린다.
 *
 * Uncategorised rows land in 미분류 and quietly distort every comparison. The
 * finding names them; what to do about them is the representative's call.
 */
export const everyRowClassified: Policy = {
  id: "rows-classified",
  expected: "모든 거래에 분류가 있어야 합니다.",
  check(transactions, _rules, month) {
    const blank = transactions.filter((tx) => tx.date.startsWith(month) && tx.category.trim() === "");
    if (blank.length === 0) return null;

    return {
      policy: "분류 누락 없음",
      state: {
        kind: "관찰",
        text: `${month} 거래 중 ${String(blank.length)}건에 분류가 비어 있습니다.`,
        rows: blank.map((tx) => tx.row),
      },
      expected: "모든 거래에 분류가 있어야 합니다.",
      evidence: blank.slice(0, 5).map((tx) => ({
        kind: "관찰" as const,
        text: `${tx.date} · ${tx.description} · ${won(Math.abs(tx.amount))}`,
        rows: [tx.row],
      })),
    };
  },
};

export const POLICIES: Policy[] = [carryoverIsZero, transfersExcluded, everyRowClassified];

/** Runs every policy. Returns only violations — a kept rule is not news. */
export function checkPolicies(
  transactions: LedgerTransaction[],
  rules: Map<string, CategoryRule>,
  month: string,
): PolicyFinding[] {
  return POLICIES.map((p) => p.check(transactions, rules, month)).filter(
    (f): f is PolicyFinding => f !== null,
  );
}

/**
 * Whether the representative asked for a recommendation.
 *
 * Absent an explicit request, Finance reports and stops. It does not suggest,
 * and it never acts.
 */
export function recommendationRequested(text: string): boolean {
  return /추천|제안|어떻게\s*할까|어떻게\s*하면|의견|조언|골라|정리해\s*줘\s*\?/.test(text);
}
