/**
 * Finance capability — recurring payments.
 *
 * Reads a statement the representative pasted and nothing else: no bank
 * connection, no card link, no network. Art. 15: data, domain logic, and copy.
 *
 * Art. 9: every merchant, figure, and date comes from a line of the statement.
 * A cadence is stated only when the charges actually show one, and "unused" is
 * never claimed — the statement cannot know it.
 */

import type { Artifact, Ask, Observation } from "../../events/types.ts";

export const CAPABILITY_ID = "finance";

export type Charge = { merchant: string; amount: number; date: string; line: number };

export type Recurring = {
  merchant: string;
  /** The most recent amount charged. */
  amount: number;
  charges: Charge[];
  /** Mean days between charges. Null until three charges give two intervals. */
  cycleDays: number | null;
  lastCharged: string;
  /** Raised price, seen twice in one cycle — reasons the user may want to act. */
  flags: string[];
};

const LINE = /^(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s+(.+?)\s+(-?[\d,]+)\s*원?$/;

/** Reads a statement into charges. Lines that do not parse are skipped. */
export function readStatement(text: string): Charge[] {
  const charges: Charge[] = [];

  text.split("\n").forEach((raw, index) => {
    const match = LINE.exec(raw.trim());
    if (!match) return;

    const amount = Number(match[3].replace(/,/g, ""));
    if (Number.isNaN(amount) || amount <= 0) return;

    charges.push({
      date: match[1].replace(/[./]/g, "-"),
      merchant: match[2].trim(),
      amount,
      line: index + 1,
    });
  });

  return charges;
}

/**
 * Separates what repeats from what happened once.
 *
 * A merchant is recurring when it charged at least twice at a similar amount.
 * Twice is enough to call it repeating; a *cycle* needs three, because two
 * points describe an interval, not a rhythm.
 */
export function classify(charges: Charge[]): { recurring: Recurring[]; oneOff: Charge[] } {
  const byMerchant = new Map<string, Charge[]>();

  for (const charge of charges) {
    byMerchant.set(charge.merchant, [...(byMerchant.get(charge.merchant) ?? []), charge]);
  }

  const recurring: Recurring[] = [];
  const oneOff: Charge[] = [];

  for (const [merchant, list] of byMerchant) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length < 2) {
      oneOff.push(sorted[0]);
      continue;
    }

    const intervals = sorted
      .slice(1)
      .map((c, i) => (Date.parse(c.date) - Date.parse(sorted[i].date)) / 86_400_000);

    const cycleDays =
      intervals.length >= 2
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : null;

    const last = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const flags: string[] = [];

    if (last.amount > previous.amount) {
      flags.push(
        `요금이 ${previous.amount.toLocaleString("ko-KR")}원에서 ${last.amount.toLocaleString("ko-KR")}원으로 올랐습니다`,
      );
    }

    // Two charges inside a week is a double charge, not a cadence.
    if (intervals.some((d) => d <= 7)) {
      flags.push("한 주기 안에 두 번 청구된 기록이 있습니다");
    }

    recurring.push({
      merchant,
      amount: last.amount,
      charges: sorted,
      cycleDays,
      lastCharged: last.date,
      flags,
    });
  }

  return { recurring, oneOff };
}

/** One observation per charge, each pointing at its statement line (Art. 10). */
export function observe(text: string, acquiredAt: string): Observation[] {
  return readStatement(text).map((charge, index) => ({
    id: `charge-${String(index + 1)}`,
    statement: `${charge.merchant} · ${charge.amount.toLocaleString("ko-KR")}원 · ${charge.date}`,
    source: `statement:${String(charge.line)}`,
    acquiredAt,
    confidence: 1,
  }));
}

/**
 * Cancellation candidates.
 *
 * Only subscriptions the statement gives a *reason* to question: a price rise,
 * or a double charge. Finance does not propose cancelling something merely
 * because it recurs, and it cannot see usage, so it never claims something is
 * unused.
 */
export function candidates(recurring: Recurring[]): Recurring[] {
  return recurring.filter((r) => r.flags.length > 0);
}

/**
 * The judgment fork.
 *
 * Art. 6: cancelling is a value decision about what the household wants to keep
 * paying for, and Art. 5 puts anything with a money consequence behind an Ask.
 * Finance prepares; the representative decides. Returns null when nothing needs
 * them — the silent path.
 */
export function judgmentNeeded(
  holdId: string,
  recurring: Recurring[],
  raisedAt: string,
): Omit<Ask, "id"> | null {
  const flagged = candidates(recurring);
  if (flagged.length === 0) return null;

  return {
    holdId,
    question: "해지 대상으로 정리할 구독이 있습니까?",
    facts: flagged.map(
      (r) =>
        `${r.merchant} · ${r.amount.toLocaleString("ko-KR")}원${r.cycleDays ? ` · ${String(r.cycleDays)}일마다` : ""} · ${r.flags.join(", ")}`,
    ),
    options: [
      ...flagged.map((r) => ({
        id: `cancel-${r.merchant}`,
        label: `${r.merchant} 해지 대상으로 정리`,
        derivedFrom: [r.merchant],
      })),
      { id: "keep-all", label: "모두 그대로 두기", derivedFrom: [] },
    ],
    raisedAt,
  };
}

/** What Finance produces: what repeats, what does not, and what was decided. */
export function proposeArtifact(
  recurring: Recurring[],
  oneOff: Charge[],
  decided: string | null,
): Artifact {
  const monthly = recurring.reduce((sum, r) => sum + r.amount, 0);

  return {
    id: "finance-recurring",
    title: `정기 결제 ${String(recurring.length)}건 · ${monthly.toLocaleString("ko-KR")}원`,
    sections: [
      ...recurring.map((r) => ({
        heading: `${r.merchant} ${r.amount.toLocaleString("ko-KR")}원${r.cycleDays ? ` · ${String(r.cycleDays)}일마다` : ""}`,
        body: `${String(r.charges.length)}회 청구 · 마지막 ${r.lastCharged}${r.flags.length > 0 ? ` · ${r.flags.join(", ")}` : ""}`,
        derivedFrom: r.charges.map((c) => `charge-${String(c.line)}`),
      })),
      ...oneOff.map((c) => ({
        heading: `${c.merchant} ${c.amount.toLocaleString("ko-KR")}원 · 1회성`,
        body: `${c.date} 청구, 반복 기록 없음`,
        derivedFrom: [`charge-${String(c.line)}`],
      })),
      ...(decided === null
        ? []
        : [{
            heading: decided === "keep-all" ? "그대로 두기로 하셨습니다" : `${decided.replace("cancel-", "")} 해지 대상`,
            body: "해지는 대표님이 직접 진행하셔야 합니다. 저희는 정리만 해 두었습니다.",
            derivedFrom: [],
          }]),
    ],
  };
}
