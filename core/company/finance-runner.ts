/**
 * Finance execution.
 *
 * Same shape as Home's runner: the log is the only writer, and the engine is
 * untouched. Finance stops at preparation — it never cancels anything, because
 * cancelling is the representative's act (Art. 5).
 */

import { randomUUID } from "node:crypto";

import { EventLog } from "../events/log.ts";
import type { Forbidden, ForbiddenForFinance } from "./boundaries.ts";
import type { EventEnvelope } from "../events/types.ts";
import * as finance from "../capabilities/finance/index.ts";
import { anomalies, baselines, monthlyUse, onlySpending } from "../capabilities/finance/ledger.ts";
import { ALL_POLICIES_PASS, recommendationRequested, violations } from "../capabilities/finance/policy.ts";
import { readCategoryRules, readLedger } from "../infrastructure/ledger/dugong.ts";

type FinanceHold = {
  holdId: string;
  text: string;
  observed: boolean;
  asked: boolean;
  answeredWith: string | null;
  kept: boolean;
};

function financeHolds(events: EventEnvelope[]): FinanceHold[] {
  const holds = new Map<string, FinanceHold>();

  for (const { event } of events) {
    if (event.type === "HandedOver" && event.capability === finance.CAPABILITY_ID) {
      holds.set(event.holdId, {
        holdId: event.holdId,
        text: event.handover.jdText,
        observed: false,
        asked: false,
        answeredWith: null,
        kept: false,
      });
      continue;
    }

    const hold = holds.get(event.holdId);
    if (!hold) continue;

    if (event.type === "ObservationRecorded") hold.observed = true;
    if (event.type === "AskRaised") hold.asked = true;
    if (event.type === "AskAnswered") hold.answeredWith = event.optionId;
    if (event.type === "ArtifactKept") hold.kept = true;
    if (event.type === "HoldWithdrawn") holds.delete(event.holdId);
  }

  return [...holds.values()];
}

/** True while some Ask is outstanding anywhere. Art. 4: one at a time. */
function anyAskOutstanding(events: EventEnvelope[]): boolean {
  const open = new Set<string>();

  for (const { event } of events) {
    if (event.type === "AskRaised") open.add(event.ask.id);
    if (event.type === "AskAnswered") open.delete(event.askId);
  }

  return open.size > 0;
}

/**
 * Reports from the ledger.
 *
 * The Dugong Ledger is the source of truth; Finance keeps nothing of its own.
 * Only meaningful changes are recorded as observations, so a quiet month
 * produces a quiet report (Art. 2).
 */
export async function advanceFinanceFromLedger(log: EventLog, today = new Date()): Promise<void> {
  const holds = financeHolds(log.read()).filter((h) => !h.kept);
  if (holds.length === 0) return;

  const read = await readLedger();
  const rules = await readCategoryRules();
  const actor = { kind: "capability" as const, id: finance.CAPABILITY_ID };
  const now = today.toISOString();
  const currentMonth = now.slice(0, 7);

  for (const hold of holds) {
    if (!read.ok) {
      // No access is not "no spending". Say so, record nothing else.
      log.append(
        {
          type: "ObservationRecorded",
          holdId: hold.holdId,
          observation: {
            id: "ledger-unavailable",
            statement: read.reason,
            source: "가계부",
            acquiredAt: now,
            confidence: 1,
          },
        },
        actor,
        finance.CAPABILITY_ID,
        "finance",
      );
      continue;
    }

    // The ledger's own rules decide what is spending (분류규칙 · 통계포함).
    const spending = onlySpending(read.transactions);
    const months = baselines(spending);
    // A month is only complete once the next one has begun.
    const monthComplete = months.some((m) => m.month > currentMonth);
    const found = anomalies(spending, currentMonth, 3, monthComplete);
    const use = monthlyUse(read.transactions, currentMonth);
    const failed = violations({
      transactions: read.transactions,
      rules,
      month: currentMonth,
    });
    const asked = recommendationRequested(hold.text);

    // Statements are recorded with their kind. Nothing normal is recorded:
    // a kept policy and an unremarkable month both produce silence (Art. 2).
    if (!hold.observed) {
      const statements = [
        ...failed.flatMap((v) => [
          { kind: "관찰", text: `${v.policy.title} — ${v.state.text}`, rows: v.state.rows },
          { kind: "관찰", text: `운영 기준: ${v.expected}`, rows: [] as number[] },
        ]),
        ...found.map((a) => ({ kind: "추론", text: a.sentence, rows: a.rows })),
      ];

      for (const [index, statement] of statements.entries()) {
        log.append(
          {
            type: "ObservationRecorded",
            holdId: hold.holdId,
            observation: {
              id: `statement-${String(index + 1)}`,
              statement: `[${statement.kind}] ${statement.text}`,
              source: statement.rows.length > 0 ? `거래내역 ${statement.rows.join(", ")}행` : "분류규칙",
              acquiredAt: now,
              confidence: 1,
            },
          },
          actor,
          finance.CAPABILITY_ID,
          "finance",
        );
      }
    }

    const nothingToSay = failed.length === 0 && found.length === 0;

    log.append(
      {
        type: "ArtifactKept",
        holdId: hold.holdId,
        artifact: {
          id: `ledger-${currentMonth}`,
          title: nothingToSay
            ? `${currentMonth} · ${ALL_POLICIES_PASS}`
            : `${currentMonth} · 운영 기준 ${String(failed.length)}건 · 변화 ${String(found.length)}건`,
          sections: [
            // A passing policy renders nothing at all.
            ...failed.flatMap((v) => [
              {
                heading: `[관찰] ${v.state.text}`,
                body: `운영 기준: ${v.expected}`,
                derivedFrom: v.state.rows.map((r) => `거래내역 ${String(r)}행`),
              },
              ...v.evidence.map((e) => ({
                heading: `[근거] ${e.text}`,
                body: `거래내역 ${e.rows.join(", ")}행`,
                derivedFrom: e.rows.map((r) => `거래내역 ${String(r)}행`),
              })),
            ]),
            // How the money was used. No balance, no reserve, no remainder.
            ...(use.income + use.fixed + use.variable + use.assetMovement === 0
              ? []
              : [
                  {
                    heading: `[관찰] 고정비 ${use.fixed.toLocaleString("ko-KR")}원 · 변동비 ${use.variable.toLocaleString("ko-KR")}원`,
                    body: `거래내역 ${[...use.rows.fixed, ...use.rows.variable].join(", ")}행`,
                    derivedFrom: [],
                  },
                  {
                    heading: `[관찰] 수입 ${use.income.toLocaleString("ko-KR")}원 · 자산이동 ${use.assetMovement.toLocaleString("ko-KR")}원`,
                    body: `거래내역 ${[...use.rows.income, ...use.rows.assetMovement].join(", ")}행`,
                    derivedFrom: [],
                  },
                ]),
            ...found.map((a) => ({
              heading: `[추론] ${a.sentence}`,
              body: `최근 ${String(a.months)}개월 평균과 비교했습니다 · 거래내역 ${a.rows.join(", ")}행`,
              derivedFrom: a.rows.map((r) => `거래내역 ${String(r)}행`),
            })),
            // A recommendation exists only when it was asked for.
            ...(asked && (failed.length > 0 || found.length > 0)
              ? [{
                  heading: "[제안] 요청하신 의견입니다",
                  body: "판단에 필요한 사실만 위에 정리했습니다. 어떤 쪽을 보실지 말씀해 주시면 그 기준으로 다시 정리하겠습니다.",
                  derivedFrom: [],
                }]
              : []),
          ],
        },
      },
      actor,
      finance.CAPABILITY_ID,
      "finance",
    );
  }
}

/**
 * Structural guardrail (§9).
 *
 * Finance's conclusions may not carry Asset's. The compiler rejects a report
 * type that grows a balance, net worth, liability balance, asset value, or
 * investable amount — a comment would not.
 */
export type FinanceConclusion = Forbidden<ForbiddenForFinance> & {
  month: string;
  fixedSpending: number;
  variableSpending: number;
  income: number;
  assetMovement: number;
  rows: number[];
  /** Complete months the ledger holds, so a consumer knows what a baseline rests on. */
  completeMonths: number;
};

/**
 * Finance's conclusion, for another department to quote.
 *
 * Finance states how money was used. What that means for capacity is Treasury's
 * question, and nothing here answers it.
 */
export async function financeConclusion(month: string): Promise<FinanceConclusion> {
  const read = await readLedger();

  if (!read.ok) {
    return { month, income: 0, fixedSpending: 0, variableSpending: 0, assetMovement: 0, rows: [], completeMonths: 0 };
  }

  const rules = await readCategoryRules();
  const use = monthlyUse(read.transactions, month);
  const months = baselines(onlySpending(read.transactions));
  void rules;

  return {
    month,
    income: use.income,
    fixedSpending: use.fixed,
    variableSpending: use.variable,
    assetMovement: use.assetMovement,
    rows: [...use.rows.fixed, ...use.rows.variable, ...use.rows.income, ...use.rows.assetMovement],
    completeMonths: months.filter((m) => m.month < month).length,
  };
}
