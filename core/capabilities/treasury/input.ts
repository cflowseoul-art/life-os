/**
 * Treasury's input contract.
 *
 * Treasury answers one question: 앞으로 얼마를 운용할 수 있는가. It receives the
 * other departments' conclusions and never reaches past them — there is no
 * ledger type in this file, and none may be added.
 *
 * Every number Treasury produces is an inference, so `Derived` binds the value
 * to what it came from and what it assumed. A figure without both cannot be
 * constructed (Art. 8, Art. 9).
 */

import type { Forbidden, ForbiddenForTreasury } from "../../company/boundaries.ts";

/** Finance's conclusion, as Finance stated it. Quoted, never recomputed. */
export type FinanceConclusionInput = {
  month: string;
  income: number;
  fixedSpending: number;
  variableSpending: number;
  assetMovement: number;
  /** 거래내역 rows behind the figures, carried through for citation. */
  rows: number[];
  /** How many complete months Finance had. */
  completeMonths: number;
};

/** Asset's conclusion, as Asset stated it. A balance is quoted, never derived. */
export type AssetReportInput = {
  asOf: string;
  /** Balances the source recorded, by account. */
  balances: { name: string; amount: number; asOf: string; evidence: string }[];
  /** Liabilities stay separate; Treasury never nets them into assets. */
  liabilities: { name: string; amount: number; asOf: string; evidence: string }[];
};

/**
 * The rules the representative set.
 *
 * Every field is optional and none has a default. A missing rule means Treasury
 * does not calculate — it does not mean six months, or seventy percent, or any
 * other number the company chose on their behalf.
 */
export type TreasuryPolicySet = {
  /** 비상금을 몇 개월치로 두실 것인지. */
  emergencyReserveMonths?: number;
  /** 계좌에 최소한 남겨 둘 금액. */
  minimumCashFloor?: number;
};

export type Freshness = { source: string; asOf: string; ageDays: number };

/** A value, or the reason there is no value. Never a plausible-looking guess. */
export type Derived<T> =
  | { known: true; value: T; from: string[]; assumptions: string[] }
  | { known: false; reason: string };

export type TreasuryInput = {
  asOf: string;
  finance: FinanceConclusionInput;
  asset: AssetReportInput;
  policy: TreasuryPolicySet;
};

export type ReserveStatus = "미설정" | "충족" | "미달";

/**
 * What Treasury may say.
 *
 * No recommendation, no allocation, no balance of its own. The name
 * `unallocatedAfterPolicy` states what the number is — money not yet spoken for
 * once the representative's own rules are applied — rather than what it is for.
 */
export type TreasuryConclusion = Forbidden<ForbiddenForTreasury> & {
  asOf: string;
  monthlySurplus: Derived<number>;
  unallocatedAfterPolicy: Derived<number>;
  emergencyReserveStatus: Derived<ReserveStatus>;
  reserveCoverage: Derived<number>;
  cashRunway: Derived<number>;
  /** Every source quoted, with how old it was. */
  basis: Freshness[];
};
