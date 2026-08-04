/**
 * Home's fact vocabulary.
 *
 * Home used to serialize structured data into a sentence — `우유 1L · 2개 ·
 * 3,000원` — and four separate readers split it back apart with `.split(" · ")`
 * and regular expressions. Every one of those parsers existed because the fact
 * had nowhere to put a quantity except inside prose.
 *
 * Typed facts remove the round trip. Nothing writes prose any more.
 *
 * What remains is one legacy reader, at the bottom of this file. Facts recorded
 * before the migration are on disk as `unstructured` prose and cannot be
 * rewritten (Art. 18), so Home — the only department that knows what its own
 * sentences meant — reads them here, once, and every consumer above sees typed
 * facts regardless of when they were written.
 */

import { UNSTRUCTURED } from "../../events/migrate.ts";
import type { KnowledgeFact } from "../../events/types.ts";

/** An item bought, as printed on a receipt. */
export type PurchaseFact = KnowledgeFact<
  "purchase",
  { name: string; quantity: number; unit: string | null; amount: number }
>;

/** Money taken off, kept separate from purchases. Never stocked. */
export type DiscountFact = KnowledgeFact<"discount", { label: string; amount: number }>;

/** The representative said something ran out. */
export type DepletionFact = KnowledgeFact<"depletion", { name: string }>;

/** A preference the representative stated out loud. */
export type PreferenceFact = KnowledgeFact<"preference", { about: string }>;

export type HomeFact = PurchaseFact | DiscountFact | DepletionFact | PreferenceFact;

/** The receipt is the source of record for what was bought. */
export const RECEIPT_AUTHOR = { kind: "external", name: "영수증" } as const;

/** Only the representative may say something ran out, or state a preference. */
export const REPRESENTATIVE_AUTHOR = { kind: "representative" } as const;

/**
 * How Home writes a fact for a person to read.
 *
 * The department owns its phrasing. The desk asks for a line and renders it; it
 * never switches on a fact type, and neither does React (§4).
 */
export function display(fact: KnowledgeFact): string {
  const known = asHomeFact(fact);
  if (!known) return typeof fact.value === "string" ? fact.value : "";

  switch (known.type) {
    case "purchase": {
      const { name, quantity, unit, amount } = known.value;
      return `${name} · ${String(quantity)}${unit ?? "개"} · ${amount.toLocaleString("ko-KR")}원`;
    }
    case "discount":
      return `${known.value.label} · 할인 · -${known.value.amount.toLocaleString("ko-KR")}원`;
    case "depletion":
      return `${known.value.name} · 소진`;
    case "preference":
      return `선호 · ${known.value.about}`;
  }
}

/* ── Legacy ──────────────────────────────────────────────────────────────
 *
 * Below this line is the only place Home still reads prose, and it runs only on
 * facts recorded before the migration. Nothing writes these shapes.
 */

/** `우유 1L · 2개 · 3,000원` — the shape `observe()` used to emit. */
function legacyPurchase(statement: string): PurchaseFact["value"] | null {
  const parts = statement.split(" · ");
  if (parts.length !== 3 || parts[1] === "할인") return null;

  const quantity = Number(/^(\d+)/.exec(parts[1])?.[1] ?? NaN);
  if (Number.isNaN(quantity)) return null;

  const unit = /^\d+(.*)$/.exec(parts[1])?.[1].trim() ?? "";
  const amount = Number(parts[2].replace(/[^\d-]/g, ""));

  return {
    name: parts[0],
    quantity,
    unit: unit === "" ? null : unit,
    // An unreadable amount is left at zero rather than guessed: the fact is
    // about what is in the house, and inventory never depended on the figure.
    amount: Number.isNaN(amount) ? 0 : amount,
  };
}

function legacyHomeFact(fact: KnowledgeFact, statement: string): HomeFact | null {
  const depleted = /^(.+) · 소진$/.exec(statement);
  if (depleted) {
    return { ...fact, type: "depletion", value: { name: depleted[1] } } as DepletionFact;
  }

  const preferred = /^선호 · (.+)$/.exec(statement);
  if (preferred) {
    return { ...fact, type: "preference", value: { about: preferred[1] } } as PreferenceFact;
  }

  const discounted = /^(.+) · 할인 · -?([\d,]+)원$/.exec(statement);
  if (discounted) {
    return {
      ...fact,
      type: "discount",
      value: { label: discounted[1], amount: Number(discounted[2].replace(/,/g, "")) },
    } as DiscountFact;
  }

  const purchase = legacyPurchase(statement);
  if (purchase) {
    return { ...fact, type: "purchase", value: purchase } as PurchaseFact;
  }

  return null;
}

/**
 * Narrows a transported fact to something Home understands.
 *
 * Typed facts pass through. Legacy prose is read once, here. A fact belonging to
 * another department returns null rather than being coerced into Home's shapes.
 */
export function asHomeFact(fact: KnowledgeFact): HomeFact | null {
  switch (fact.type) {
    case "purchase":
    case "discount":
    case "depletion":
    case "preference":
      return fact as HomeFact;
    case UNSTRUCTURED:
      return typeof fact.value === "string" ? legacyHomeFact(fact, fact.value) : null;
    default:
      return null;
  }
}

/** Facts of one type, already narrowed. The common read in Home's memory. */
export function factsOfType<T extends HomeFact["type"]>(
  facts: KnowledgeFact[],
  type: T,
): Extract<HomeFact, { type: T }>[] {
  const out: Extract<HomeFact, { type: T }>[] = [];

  for (const fact of facts) {
    const known = asHomeFact(fact);
    if (known?.type === type) out.push(known as Extract<HomeFact, { type: T }>);
  }

  return out;
}
