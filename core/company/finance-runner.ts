/**
 * Finance execution.
 *
 * Same shape as Home's runner: the log is the only writer, and the engine is
 * untouched. Finance stops at preparation — it never cancels anything, because
 * cancelling is the representative's act (Art. 5).
 */

import { randomUUID } from "node:crypto";

import { EventLog } from "../events/log.ts";
import type { EventEnvelope } from "../events/types.ts";
import * as finance from "../capabilities/finance/index.ts";
import { anomalies, baselines, onlySpending } from "../capabilities/finance/ledger.ts";
import { ALL_POLICIES_PASS, recommendationRequested, violations } from "../capabilities/finance/policy.ts";
import { readCategoryRules, readKpi, readLedger } from "../infrastructure/ledger/dugong.ts";

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
  const kpi = await readKpi();
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
    const failed = violations({
      transactions: read.transactions,
      rules,
      month: currentMonth,
      kpi: kpi.get(currentMonth),
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

export function advanceFinance(log: EventLog): void {
  for (const hold of financeHolds(log.read())) {
    if (hold.kept) continue;

    const charges = finance.readStatement(hold.text);
    if (charges.length === 0) continue;

    const actor = { kind: "capability" as const, id: finance.CAPABILITY_ID };
    const now = new Date().toISOString();
    const { recurring, oneOff } = finance.classify(charges);

    if (!hold.observed) {
      for (const observation of finance.observe(hold.text, now)) {
        log.append(
          { type: "ObservationRecorded", holdId: hold.holdId, observation },
          actor,
          finance.CAPABILITY_ID,
          "finance",
        );
      }
    }

    // Judgment first: only a flagged subscription reaches the representative.
    if (!hold.asked && hold.answeredWith === null) {
      const needed = finance.judgmentNeeded(hold.holdId, recurring, now);

      if (needed) {
        if (anyAskOutstanding(log.read())) continue;

        log.append(
          { type: "AskRaised", holdId: hold.holdId, ask: { ...needed, id: randomUUID() } },
          actor,
          finance.CAPABILITY_ID,
          "finance",
        );
        continue;
      }
    }

    if (hold.asked && hold.answeredWith === null) continue;

    log.append(
      {
        type: "ArtifactKept",
        holdId: hold.holdId,
        artifact: finance.proposeArtifact(recurring, oneOff, hold.answeredWith),
      },
      actor,
      finance.CAPABILITY_ID,
      "finance",
    );
  }
}

/** Finance's memory: what repeats, and on what cycle. */
export function subscriptions(events: EventEnvelope[]): finance.Recurring[] {
  const charges: finance.Charge[] = [];

  for (const envelope of events) {
    const { event } = envelope;
    if (event.type !== "ObservationRecorded" || envelope.capability !== finance.CAPABILITY_ID) continue;

    const [merchant, amount, date] = event.observation.statement.split(" · ");
    const value = Number((amount ?? "").replace(/[,원]/g, ""));

    if (merchant && date && !Number.isNaN(value)) {
      charges.push({ merchant, amount: value, date, line: 0 });
    }
  }

  return finance.classify(charges).recurring;
}
