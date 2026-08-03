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

/** A statement, and what kind of statement it is. */
export type Statement = {
  kind: "관찰" | "추론" | "제안";
  text: string;
  /** 거래내역 rows behind it. */
  rows: number[];
};

export type Severity = "low" | "medium" | "high";

/** Everything a policy is evaluated against. Read-only. */
export type PolicyContext = {
  transactions: LedgerTransaction[];
  rules: Map<string, CategoryRule>;
  month: string;
};

/**
 * A policy is data, not code.
 *
 * `condition` answers one question — does the rule hold? — and everything the
 * report says is built from `evidence` and `template`. Adding a policy means
 * adding an entry to the registry; no evaluation logic changes, and no
 * department gains a special case.
 *
 * A policy may never propose a fix or perform an action. There is nowhere in
 * this shape to put one (Art. 6).
 */
export type PolicyDefinition = {
  id: string;
  title: string;
  /** The department accountable for the rule. */
  owner: string;
  severity: Severity;
  /** True when the representative's rule is being followed. */
  condition(context: PolicyContext): boolean;
  /** The rows that demonstrate the current state. */
  evidence(context: PolicyContext): Statement[];
  template: {
    /** What the ledger currently shows. */
    state(context: PolicyContext): string;
    /** The rule, as the representative set it. */
    expected: string;
  };
};

export type PolicyResult = {
  policy: PolicyDefinition;
  passed: boolean;
  state: Statement;
  expected: string;
  evidence: Statement[];
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** Rows of a given flow in the month under review. */
function rowsOfFlow(context: PolicyContext, flow: Flow): LedgerTransaction[] {
  return context.transactions.filter(
    (tx) => tx.date.startsWith(context.month) && flowOf(tx, context.rules) === flow,
  );
}

function asEvidence(transactions: LedgerTransaction[], limit = 5): Statement[] {
  return transactions.slice(0, limit).map((tx) => ({
    kind: "관찰" as const,
    text: `${tx.date} · ${tx.description} · ${won(Math.abs(tx.amount))}`,
    rows: [tx.row],
  }));
}

/**
 * The registry. Every operating rule the representative has set, as data.
 */
export const POLICIES: PolicyDefinition[] = [
  {
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
  },
  {
    id: "transfers-excluded",
    title: "이동은 통계 제외",
    owner: "finance",
    severity: "medium",
    condition: (ctx) =>
      [...ctx.rules.values()].every((r) => !r.type.includes("이동") || !r.countsAsSpending),
    evidence: (ctx) => {
      const wrong = [...ctx.rules.values()].filter((r) => r.type.includes("이동") && r.countsAsSpending);
      return asEvidence(
        ctx.transactions.filter(
          (tx) => tx.date.startsWith(ctx.month) && wrong.some((r) => r.category === tx.category.trim()),
        ),
      );
    },
    template: {
      state: (ctx) => {
        const wrong = [...ctx.rules.values()].filter((r) => r.type.includes("이동") && r.countsAsSpending);
        return `분류규칙에서 ${wrong.map((r) => r.category).join(", ")}가 통계포함 Y로 돼 있습니다.`;
      },
      expected: "저축·투자·카드대금 이동은 통계에서 제외돼야 합니다.",
    },
  },
  {
    id: "rows-classified",
    title: "분류 누락 없음",
    owner: "finance",
    severity: "low",
    condition: (ctx) =>
      ctx.transactions.every((tx) => !tx.date.startsWith(ctx.month) || tx.category.trim() !== ""),
    evidence: (ctx) =>
      asEvidence(
        ctx.transactions.filter((tx) => tx.date.startsWith(ctx.month) && tx.category.trim() === ""),
      ),
    template: {
      state: (ctx) => {
        const blank = ctx.transactions.filter(
          (tx) => tx.date.startsWith(ctx.month) && tx.category.trim() === "",
        );
        return `${ctx.month} 거래 중 ${String(blank.length)}건에 분류가 비어 있습니다.`;
      },
      expected: "모든 거래에 분류가 있어야 합니다.",
    },
  },
];

/** Evaluates the registry. Order follows severity, worst first. */
export function evaluatePolicies(context: PolicyContext, registry = POLICIES): PolicyResult[] {
  const weight: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

  return registry
    .map((policy) => {
      const passed = policy.condition(context);

      return {
        policy,
        passed,
        state: {
          kind: "관찰" as const,
          text: passed ? `${policy.title} — 정상입니다.` : policy.template.state(context),
          rows: passed ? [] : policy.evidence(context).flatMap((e) => e.rows),
        },
        expected: policy.template.expected,
        evidence: passed ? [] : policy.evidence(context),
      };
    })
    .sort((a, b) => weight[a.policy.severity] - weight[b.policy.severity]);
}

/** Only the rules that are not being followed. A kept rule is not news. */
export function violations(context: PolicyContext, registry = POLICIES): PolicyResult[] {
  return evaluatePolicies(context, registry).filter((r) => !r.passed);
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
