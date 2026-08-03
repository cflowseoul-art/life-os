/**
 * Finance domain logic over the Dugong Ledger.
 *
 * Baselines, anomalies, and receipt matching. Pure functions over transactions
 * the adapter read — no storage, no second copy of the money (Art. 11).
 *
 * Art. 9: a baseline is stated only when enough complete months exist to make
 * one. Below that, the figure is null and the sentence is written without it.
 */

import type { LedgerTransaction } from "../../infrastructure/ledger/dugong.ts";

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
};

/** Every month present in the ledger, oldest first. */
export function baselines(transactions: LedgerTransaction[]): MonthlyBaseline[] {
  const months = new Map<string, MonthlyBaseline>();

  for (const tx of transactions) {
    const key = month(tx.date);
    const entry = months.get(key) ?? { month: key, total: 0, byCategory: {} };
    const category = tx.category.trim() === "" ? "미분류" : tx.category.trim();

    entry.total += spend(tx);
    entry.byCategory[category] = (entry.byCategory[category] ?? 0) + spend(tx);
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
  sentence: string;
};

/**
 * Meaningful changes only.
 *
 * Three gates, all of which must pass, so the representative is never told
 * about noise (Art. 1):
 *   - at least two complete months of history for that category
 *   - the change is at least 15%
 *   - and at least 30,000원 in absolute terms
 *
 * A 40% rise on a 3,000원 category is arithmetic, not news.
 */
export function anomalies(
  transactions: LedgerTransaction[],
  currentMonth: string,
  lookback = 3,
): Anomaly[] {
  const months = baselines(transactions);
  const current = months.find((m) => m.month === currentMonth);
  if (!current) return [];

  const previous = months.filter((m) => m.month < currentMonth).slice(-lookback);
  if (previous.length < 2) return [];

  const found: Anomaly[] = [];

  for (const [category, amount] of Object.entries(current.byCategory)) {
    const history = previous.map((m) => m.byCategory[category] ?? 0);
    const withSpend = history.filter((v) => v > 0);
    if (withSpend.length < 2) continue;

    const baseline = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
    if (baseline === 0) continue;

    const change = Math.round(((amount - baseline) / baseline) * 100);
    const gap = Math.abs(amount - baseline);

    if (Math.abs(change) < 15 || gap < 30_000) continue;

    found.push({
      category,
      month: currentMonth,
      amount,
      baseline,
      months: previous.length,
      changePercent: change,
      sentence:
        `이번 달 ${category}가 최근 ${String(previous.length)}개월 평균보다 `
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
