/**
 * Home's memory.
 *
 * §5: Home owns inventory, purchase history, and household preferences. This
 * module derives all of it from recorded events — nothing is stored separately,
 * so memory cannot drift from what actually happened (Art. 11).
 *
 * Art. 10: every remembered fact carries where it came from and when. A figure
 * that cannot be derived is returned as `null` and the sentence above it is
 * written without it (Art. 9) — never filled in with a plausible number.
 *
 * The rule that matters most: **one purchase is not a preference.** Buying
 * 서울우유 once says nothing about what the household wants; only the
 * representative saying so does.
 */

import type { EventEnvelope } from "../../events/types.ts";

export const CAPABILITY_ID = "home";

export type ProductMemory = {
  /** The product as printed on receipts. Size included. */
  name: string;
  /** Bought minus explicitly used up. Never negative. */
  onHand: number;
  lastBought: string;
  /** How many times it has been bought. */
  purchases: number;
  /** The quantity bought most often. Null until bought at least twice. */
  usualQuantity: number | null;
  /** Mean days between purchases. Null until bought at least three times. */
  repeatDays: number | null;
};

export type Preference = {
  /** What the preference is about, in the representative's words. */
  about: string;
  /** What they said. */
  statement: string;
  /** The utterance it came from. */
  source: string;
  at: string;
};

type Purchase = { name: string; quantity: number; at: string };

/** Reads purchases out of Home's own observations. */
function purchases(events: EventEnvelope[]): Purchase[] {
  const out: Purchase[] = [];

  for (const envelope of events) {
    const { event } = envelope;
    if (event.type !== "ObservationRecorded" || envelope.capability !== CAPABILITY_ID) continue;

    // name · quantity+unit · amount   (discounts and notes have other shapes)
    const parts = event.observation.statement.split(" · ");
    if (parts.length !== 3 || parts[1] === "할인") continue;

    const quantity = Number(/^(\d+)/.exec(parts[1])?.[1] ?? NaN);
    if (Number.isNaN(quantity)) continue;

    out.push({ name: parts[0], quantity, at: event.observation.acquiredAt });
  }

  return out;
}

/** Explicit depletions: the representative said something ran out. */
function depletions(events: EventEnvelope[]): { name: string; at: string }[] {
  const out: { name: string; at: string }[] = [];

  for (const envelope of events) {
    const { event } = envelope;
    if (event.type !== "ObservationRecorded" || envelope.capability !== CAPABILITY_ID) continue;

    const match = /^(.+) · 소진$/.exec(event.observation.statement);
    if (match) out.push({ name: match[1], at: event.observation.acquiredAt });
  }

  return out;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/**
 * What the household has, and what is known about how it is bought.
 *
 * `usualQuantity` needs two purchases; `repeatDays` needs three. Below those
 * thresholds the field is null rather than a guess from a single data point.
 */
export function remember(events: EventEnvelope[]): ProductMemory[] {
  const byName = new Map<string, Purchase[]>();

  for (const purchase of purchases(events)) {
    byName.set(purchase.name, [...(byName.get(purchase.name) ?? []), purchase]);
  }

  const usedUp = depletions(events);

  return [...byName.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
    const bought = sorted.reduce((sum, p) => sum + p.quantity, 0);

    // A depletion clears the shelf: the representative said it is gone.
    const lastDepletion = usedUp
      .filter((d) => name.includes(d.name) || d.name.includes(name))
      .sort((a, b) => b.at.localeCompare(a.at))[0];

    const sinceDepletion = lastDepletion
      ? sorted.filter((p) => p.at > lastDepletion.at)
      : sorted;

    const intervals = sorted
      .slice(1)
      .map((p, i) => (Date.parse(p.at) - Date.parse(sorted[i].at)) / 86_400_000);

    return {
      name,
      onHand: lastDepletion ? sinceDepletion.reduce((s, p) => s + p.quantity, 0) : bought,
      lastBought: sorted[sorted.length - 1].at,
      purchases: sorted.length,
      usualQuantity: sorted.length >= 2 ? mode(sorted.map((p) => p.quantity)) : null,
      // Three purchases give two intervals; a mean under a day is not a cadence.
      repeatDays: (() => {
        if (intervals.length < 2) return null;
        const mean = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        return mean >= 1 ? mean : null;
      })(),
    };
  });
}

/**
 * Preferences, and only explicit ones.
 *
 * A preference exists when the representative stated it in words — "저지방으로",
 * "서울우유만". Nothing about what was bought, however often, ever becomes a
 * preference here (Art. 6: values are theirs to state, not ours to infer).
 */
const PREFERENCE_PATTERNS = [
  /(.+?)(?:으로|로)\s*(?:만|사|사줘|주문|부탁)/,
  /(.+?)만\s*(?:사|사줘|주문|써|쓰)/,
  /항상\s*(.+?)(?:으로|로|만)/,
];

export function statedPreference(text: string, at: string, source: string): Preference | null {
  for (const pattern of PREFERENCE_PATTERNS) {
    const match = pattern.exec(text.trim());
    if (match && match[1].trim() !== "") {
      return { about: match[1].trim(), statement: text.trim(), source, at };
    }
  }

  return null;
}

/** Preferences the representative has actually stated, newest first. */
export function preferences(events: EventEnvelope[]): Preference[] {
  const out: Preference[] = [];

  for (const envelope of events) {
    const { event } = envelope;
    if (event.type !== "ObservationRecorded" || envelope.capability !== CAPABILITY_ID) continue;

    const match = /^선호 · (.+)$/.exec(event.observation.statement);
    if (match) {
      out.push({
        about: match[1],
        statement: match[1],
        source: event.observation.source,
        at: event.observation.acquiredAt,
      });
    }
  }

  return out.reverse();
}

/** Finds what the representative meant by a loose word like 우유. */
export function matchProduct(memory: ProductMemory[], word: string): ProductMemory | null {
  const hits = memory.filter((m) => m.name.includes(word));
  if (hits.length === 0) return null;

  // The one bought most recently is the one they mean.
  return hits.sort((a, b) => b.lastBought.localeCompare(a.lastBought))[0];
}
