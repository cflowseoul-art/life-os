/**
 * Department boundaries, enforced by the compiler.
 *
 * Each department may state its own conclusions and nothing else. A report type
 * that grows a neighbour's field fails to compile — a comment would not.
 *
 * Shared low-level ledger types are fine. Shared department *conclusions* are
 * not: that is how one department starts answering another's question.
 */

export type Forbidden<K extends string> = { [P in K]?: never };

/** Finance explains how money was used. State is not its to state. */
export type ForbiddenForFinance =
  | "balance" | "netWorth" | "liabilityBalance" | "assetValue"
  | "investableAmount" | "unallocatedAfterPolicy"
  | "cashRunway" | "monthlySurplus" | "reserveCoverage";

/** Asset explains what is owned or owed. Spending and capacity are not its to state. */
export type ForbiddenForAsset =
  | "fixedSpending" | "variableSpending" | "categoryAnomaly" | "merchantTrend"
  | "investableAmount" | "unallocatedAfterPolicy" | "cashRunway"
  | "investmentRecommendation";

/**
 * Treasury calculates capacity from the other two departments' conclusions.
 *
 * It holds no transactions, computes no balance, and — deliberately — has no
 * field for a recommendation or an allocation. How much to invest is the
 * representative's decision, not a computed value (Art. 6).
 */
export type ForbiddenForTreasury =
  | "balance" | "snapshots" | "transactions"
  | "fixedSpending" | "variableSpending" | "categoryAnomaly" | "merchantTrend"
  | "liabilityBalance"
  | "investmentRecommendation" | "allocation" | "investableAmount";
