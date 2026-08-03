/**
 * Treasury's calculations.
 *
 * Pure functions over the two departments' conclusions. No ledger, no
 * transactions, no balance of its own — a balance is quoted from Asset and a
 * spending figure is quoted from Finance.
 *
 * Each function returns `Derived`, so a figure that cannot honestly be produced
 * comes back as a reason instead of a number.
 */

import type {
  Derived,
  Freshness,
  ReserveStatus,
  TreasuryConclusion,
  TreasuryInput,
} from "./input.ts";

const DAY = 86_400_000;

/** How stale each quoted source is. Old state is reported, never hidden. */
export function freshness(input: TreasuryInput): Freshness[] {
  const now = Date.parse(input.asOf);

  return input.asset.balances.map((b) => ({
    source: `${b.name} (${b.evidence})`,
    asOf: b.asOf,
    ageDays: Math.max(0, Math.round((now - Date.parse(b.asOf)) / DAY)),
  }));
}

/** 수입 − (고정비 + 변동비). Asset movement is not spending and is left out. */
export function monthlySurplus(input: TreasuryInput): Derived<number> {
  const { income, fixedSpending, variableSpending, month, rows } = input.finance;

  if (income === 0 && fixedSpending === 0 && variableSpending === 0) {
    return { known: false, reason: `${month} 수입·지출 기록이 없어 계산하지 않았습니다.` };
  }

  return {
    known: true,
    value: income - fixedSpending - variableSpending,
    from: [`재무팀 ${month} 결론`, `거래내역 ${rows.slice(0, 12).join(", ")}행`],
    assumptions: ["자산이동은 지출로 보지 않았습니다."],
  };
}

/** Cash the representative's own rules have not already spoken for. */
export function unallocatedAfterPolicy(input: TreasuryInput): Derived<number> {
  const { minimumCashFloor, emergencyReserveMonths } = input.policy;

  if (minimumCashFloor === undefined && emergencyReserveMonths === undefined) {
    return {
      known: false,
      reason: "최소 잔고나 비상금 기준을 정해 주시지 않아 계산하지 않았습니다.",
    };
  }

  const cash = input.asset.balances.reduce((sum, b) => sum + b.amount, 0);
  if (input.asset.balances.length === 0) {
    return { known: false, reason: "자산팀에 기록된 잔액이 없어 계산하지 않았습니다." };
  }

  const monthlyOutflow = input.finance.fixedSpending + input.finance.variableSpending;
  const reserve =
    emergencyReserveMonths === undefined ? 0 : emergencyReserveMonths * monthlyOutflow;
  const floor = minimumCashFloor ?? 0;

  return {
    known: true,
    value: cash - Math.max(reserve, floor),
    from: input.asset.balances.map((b) => b.evidence),
    assumptions: [
      emergencyReserveMonths === undefined
        ? "비상금 기준은 정해지지 않아 반영하지 않았습니다."
        : `비상금은 ${String(emergencyReserveMonths)}개월치(${reserve.toLocaleString("ko-KR")}원)로 두었습니다.`,
      minimumCashFloor === undefined
        ? "최소 잔고 기준은 정해지지 않았습니다."
        : `최소 잔고 ${floor.toLocaleString("ko-KR")}원을 남겼습니다.`,
      "쓰이지 않은 돈이라는 뜻이지, 투자해도 되는 돈이라는 뜻은 아닙니다.",
    ],
  };
}

/** Months of outflow the recorded balance covers. */
export function reserveCoverage(input: TreasuryInput): Derived<number> {
  const outflow = input.finance.fixedSpending + input.finance.variableSpending;

  if (outflow === 0) {
    return { known: false, reason: "이번 달 지출 기록이 없어 계산하지 않았습니다." };
  }
  if (input.asset.balances.length === 0) {
    return { known: false, reason: "자산팀에 기록된 잔액이 없어 계산하지 않았습니다." };
  }

  const cash = input.asset.balances.reduce((sum, b) => sum + b.amount, 0);

  return {
    known: true,
    value: Math.round((cash / outflow) * 10) / 10,
    from: input.asset.balances.map((b) => b.evidence),
    assumptions: [`${input.finance.month} 지출이 계속된다고 두었습니다.`],
  };
}

export function emergencyReserveStatus(input: TreasuryInput): Derived<ReserveStatus> {
  const months = input.policy.emergencyReserveMonths;

  if (months === undefined) {
    return { known: true, value: "미설정", from: [], assumptions: ["비상금 기준을 정해 주시지 않았습니다."] };
  }

  const coverage = reserveCoverage(input);
  if (!coverage.known) return { known: false, reason: coverage.reason };

  return {
    known: true,
    value: coverage.value >= months ? "충족" : "미달",
    from: coverage.from,
    assumptions: [...coverage.assumptions, `기준은 ${String(months)}개월입니다.`],
  };
}

/**
 * How long the recorded balance lasts.
 *
 * Needs three complete months to have a spending baseline worth projecting.
 * Below that it says so rather than projecting from one month.
 */
export function cashRunway(input: TreasuryInput): Derived<number> {
  if (input.finance.completeMonths < 3) {
    return {
      known: false,
      reason: `완결된 달이 ${String(input.finance.completeMonths)}개뿐이라 계산하지 않았습니다.`,
    };
  }

  return reserveCoverage(input);
}

export function conclude(input: TreasuryInput): TreasuryConclusion {
  return {
    asOf: input.asOf,
    monthlySurplus: monthlySurplus(input),
    unallocatedAfterPolicy: unallocatedAfterPolicy(input),
    emergencyReserveStatus: emergencyReserveStatus(input),
    reserveCoverage: reserveCoverage(input),
    cashRunway: cashRunway(input),
    basis: freshness(input),
  };
}
