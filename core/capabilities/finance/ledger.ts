/**
 * Finance domain logic over the Dugong Ledger.
 *
 * Baselines, anomalies, and receipt matching. Pure functions over transactions
 * the adapter read — no storage, no second copy of the money (Art. 11).
 *
 * Art. 9: a baseline is stated only when enough complete months exist to make
 * one. Below that, the figure is null and the sentence is written without it.
 */

import type { CategoryRule, LedgerTransaction } from "../../infrastructure/ledger/dugong.ts";

/**
 * Spending, as the ledger itself defines it.
 *
 * 분류규칙 marks card settlements, transfers, and carried balances with
 * 통계포함 = N. Those are money moving, not money spent, and counting them
 * would overstate every figure Finance states. When no rule exists for a
 * category, it counts — the ledger's silence is not a licence to drop a row.
 */
export function isSpending(tx: LedgerTransaction, rules: Map<string, CategoryRule>): boolean {
  const rule = rules.get(tx.category.trim());
  return rule ? rule.countsAsSpending : true;
}

export function onlySpending(
  transactions: LedgerTransaction[],
  rules: Map<string, CategoryRule>,
): LedgerTransaction[] {
  return transactions.filter((tx) => isSpending(tx, rules));
}

/** Money out, as a positive figure. The ledger's sign convention stays there. */
function spend(tx: LedgerTransaction): number {
  return tx.amount < 0 ? -tx.amount : tx.amount;
}

function month(date: string): string {
  return date.slice(0, 7);
}

export type MonthlyBaseline = {
  month: string;
  total: number;
  byCategory: Record<string, number>;
  /** 거래내역 row numbers behind each category, so any figure can be checked. */
  rowsByCategory: Record<string, number[]>;
};

/** Every month present in the ledger, oldest first. */
export function baselines(transactions: LedgerTransaction[]): MonthlyBaseline[] {
  const months = new Map<string, MonthlyBaseline>();

  for (const tx of transactions) {
    const key = month(tx.date);
    const entry = months.get(key) ?? { month: key, total: 0, byCategory: {}, rowsByCategory: {} };
    const category = tx.category.trim() === "" ? "미분류" : tx.category.trim();

    entry.total += spend(tx);
    entry.byCategory[category] = (entry.byCategory[category] ?? 0) + spend(tx);
    entry.rowsByCategory[category] = [...(entry.rowsByCategory[category] ?? []), tx.row];
    months.set(key, entry);
  }

  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export type Anomaly = {
  category: string;
  month: string;
  amount: number;
  /** Mean of the preceding complete months used as the comparison. */
  baseline: number;
  months: number;
  /** Signed percentage against the baseline. */
  changePercent: number;
  /** 거래내역 rows that make up this month's figure. */
  rows: number[];
  sentence: string;
};

/** 받침 decides the subject particle. "식료품이", not "식료품가". */
function subject(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? "이" : "가"}`;
}

/**
 * Meaningful changes only.
 *
 * Gates, all of which must pass, so the representative is never told about
 * noise (Art. 1):
 *   - at least one complete prior month for that category
 *   - the change is at least 15%
 *   - and at least 30,000원 in absolute terms
 *   - and, while the month is still running, only *increases* are reported:
 *     an unfinished month is naturally below a finished one, and reporting
 *     that as a drop would be a false alarm every time.
 *
 * A 40% rise on a 3,000원 category is arithmetic, not news.
 */
export function anomalies(
  transactions: LedgerTransaction[],
  currentMonth: string,
  lookback = 3,
  monthComplete = false,
): Anomaly[] {
  const months = baselines(transactions);
  const current = months.find((m) => m.month === currentMonth);
  if (!current) return [];

  // However many complete months exist, up to `lookback`. The sentence always
  // names how many were used, so a two-month average is never read as three.
  const previous = months.filter((m) => m.month < currentMonth).slice(-lookback);
  if (previous.length < 1) return [];

  const found: Anomaly[] = [];

  for (const [category, amount] of Object.entries(current.byCategory)) {
    const history = previous.map((m) => m.byCategory[category] ?? 0);
    if (history.filter((v) => v > 0).length < 1) continue;

    const baseline = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
    if (baseline === 0) continue;

    const change = Math.round(((amount - baseline) / baseline) * 100);
    const gap = Math.abs(amount - baseline);

    if (Math.abs(change) < 15 || gap < 30_000) continue;
    if (!monthComplete && change < 0) continue;

    found.push({
      category,
      month: currentMonth,
      amount,
      baseline,
      months: previous.length,
      changePercent: change,
      rows: current.rowsByCategory[category] ?? [],
      sentence:
        `이번 달 ${subject(category)} 최근 ${String(previous.length)}개월 평균보다 `
        + `${String(Math.abs(change))}% ${change > 0 ? "높습니다" : "낮습니다"} `
        + `(${amount.toLocaleString("ko-KR")}원 · 평균 ${baseline.toLocaleString("ko-KR")}원).`,
    });
  }

  return found.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

export type ReceiptMatch =
  | { matched: true; transaction: LedgerTransaction; why: string }
  | { matched: false; reason: string };

/**
 * Match-or-create, stopping firmly at *match*.
 *
 * A receipt must find its transaction in the ledger before any detail is
 * attached to it. Nothing is written today: an unmatched receipt stays pending,
 * and pending is a correct resting state, not a failure. Creating a ledger row
 * from a receipt would make Life OS a second source of truth for money, which
 * this design exists to prevent.
 */
export function matchReceipt(
  transactions: LedgerTransaction[],
  receipt: { store: string; total: number; date: string },
  dayWindow = 3,
): ReceiptMatch {
  const day = Date.parse(receipt.date);

  const sameAmount = transactions.filter((tx) => spend(tx) === receipt.total);
  if (sameAmount.length === 0) {
    return { matched: false, reason: "금액이 같은 거래를 가계부에서 찾지 못했습니다. 보류해 두었습니다." };
  }

  const nearby = sameAmount.filter(
    (tx) => Math.abs(Date.parse(tx.date) - day) <= dayWindow * 86_400_000,
  );
  if (nearby.length === 0) {
    return { matched: false, reason: "금액은 같지만 날짜가 맞는 거래가 없습니다. 보류해 두었습니다." };
  }

  const store = receipt.store.replace(/\s+/g, "");
  const byName = nearby.filter((tx) => {
    const description = tx.description.replace(/\s+/g, "");
    return description !== "" && (description.includes(store) || store.includes(description));
  });

  if (byName.length === 1) {
    return {
      matched: true,
      transaction: byName[0],
      why: `금액·날짜·가맹점이 모두 맞습니다 (거래내역 ${String(byName[0].row)}행).`,
    };
  }

  if (nearby.length === 1) {
    return {
      matched: true,
      transaction: nearby[0],
      why: `금액과 날짜가 맞습니다 (거래내역 ${String(nearby[0].row)}행).`,
    };
  }

  return {
    matched: false,
    reason: `금액과 날짜가 맞는 거래가 ${String(nearby.length)}건이라 어느 것인지 정할 수 없습니다. 보류해 두었습니다.`,
  };
}
