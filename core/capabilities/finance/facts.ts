/**
 * Finance's fact vocabulary.
 *
 * Finance encoded a fact's *kind* into the front of its own sentence —
 * `[관찰] …`, `[추론] …` — and read it back by string prefix. That prefix was a
 * type field wearing a disguise, and it is now a type field.
 *
 * The distinction it was carrying matters more than the parsing it caused.
 * §5: an inference is owned by the department that inferred it and is recorded
 * *as an inference*, never laundered into an observation. Two fact types keep
 * that separation in the data rather than in a naming convention.
 *
 * Note this covers Finance's **facts** only. Finance also writes `[관찰]` into
 * artifact section headings, which is a separate prose encoding on a type
 * (`Artifact`) this change does not touch.
 */

import { UNSTRUCTURED } from "../../events/migrate.ts";
import type { KnowledgeFact } from "../../events/types.ts";

/** Read straight off the ledger: a rule that failed, a figure that is there. */
export type ObservationFact = KnowledgeFact<"observation", { text: string }>;

/** Finance's own reading of a deviation. Never a direct ledger reading. */
export type InferenceFact = KnowledgeFact<"inference", { text: string }>;

/** The department could not reach its source of record. */
export type UnavailableFact = KnowledgeFact<"unavailable", { reason: string }>;

export type FinanceFact = ObservationFact | InferenceFact | UnavailableFact;

/** The ledger is the source of record for what was spent. */
export const LEDGER_AUTHOR = { kind: "external", name: "가계부" } as const;

/** An inference is the company's own reading, not the ledger's statement. */
export const SYSTEM_AUTHOR = { kind: "system" } as const;

/**
 * Confidence for a system inference.
 *
 * An anomaly is an interpretation: the ledger supports the arithmetic, not the
 * judgement that a deviation is worth mentioning. Per the confidence rule an
 * inference must sit below 1, so it does.
 *
 * The specific value is declared, not measured. A real scale for interpretive
 * confidence does not exist yet, and inventing a precise-looking number would
 * be the kind of unsourced figure Art. 9 exists to reject.
 */
export const INFERENCE_CONFIDENCE = 0.5;

/**
 * How Finance writes a fact for a person to read.
 *
 * The bracket labels survive here as *display*, which is what they always
 * should have been — a word shown to the representative, not a parsed field.
 */
export function display(fact: KnowledgeFact): string {
  const known = asFinanceFact(fact);
  if (!known) return typeof fact.value === "string" ? fact.value : "";

  switch (known.type) {
    case "observation":
      return `[관찰] ${known.value.text}`;
    case "inference":
      return `[추론] ${known.value.text}`;
    case "unavailable":
      return known.value.reason;
  }
}

/* ── Legacy ──────────────────────────────────────────────────────────────
 *
 * Facts recorded before the migration carry the bracket prefix inside their
 * prose. Read here, once, and never written again.
 */

function legacyFinanceFact(fact: KnowledgeFact, statement: string): FinanceFact {
  const tagged = /^\[(관찰|추론|근거|제안)\]\s*(.*)$/.exec(statement);

  if (tagged) {
    const text = tagged[2];
    return tagged[1] === "추론"
      ? ({ ...fact, type: "inference", value: { text } } as InferenceFact)
      : ({ ...fact, type: "observation", value: { text } } as ObservationFact);
  }

  // Untagged legacy prose was the ledger-unavailable reason, the only fact
  // Finance ever wrote without a bracket.
  return { ...fact, type: "unavailable", value: { reason: statement } } as UnavailableFact;
}

/** Narrows a transported fact to something Finance understands. */
export function asFinanceFact(fact: KnowledgeFact): FinanceFact | null {
  switch (fact.type) {
    case "observation":
    case "inference":
    case "unavailable":
      return fact as FinanceFact;
    case UNSTRUCTURED:
      return typeof fact.value === "string" ? legacyFinanceFact(fact, fact.value) : null;
    default:
      return null;
  }
}
