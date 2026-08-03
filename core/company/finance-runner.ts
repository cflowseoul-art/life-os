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
import { anomalies, baselines } from "../capabilities/finance/ledger.ts";
import { readLedger } from "../infrastructure/ledger/dugong.ts";

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

    const found = anomalies(read.transactions, currentMonth);
    const months = baselines(read.transactions);
    const thisMonth = months.find((m) => m.month === currentMonth);

    if (!hold.observed) {
      for (const [index, anomaly] of found.entries()) {
        log.append(
          {
            type: "ObservationRecorded",
            holdId: hold.holdId,
            observation: {
              id: `anomaly-${String(index + 1)}`,
              statement: anomaly.sentence,
              source: `거래내역 · ${anomaly.month}`,
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

    log.append(
      {
        type: "ArtifactKept",
        holdId: hold.holdId,
        artifact: {
          id: `ledger-${currentMonth}`,
          title: thisMonth
            ? `${currentMonth} 지출 ${thisMonth.total.toLocaleString("ko-KR")}원`
            : `${currentMonth} 지출 기록 없음`,
          sections: [
            ...found.map((a, i) => ({
              heading: a.sentence,
              body: `평균은 최근 ${String(a.months)}개월 기준입니다.`,
              derivedFrom: [`anomaly-${String(i + 1)}`],
            })),
            ...Object.entries(thisMonth?.byCategory ?? {}).map(([category, amount]) => ({
              heading: `${category} ${amount.toLocaleString("ko-KR")}원`,
              body: "거래내역에서 합산했습니다.",
              derivedFrom: [],
            })),
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
