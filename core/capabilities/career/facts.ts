/**
 * Career's fact vocabulary.
 *
 * §5 (Memory ownership) and the kernel's contract: `type` and `value` belong to
 * the department. The kernel stores and transports them without ever looking
 * inside, so this file — not `core/events/` — is where "what Career can know"
 * is defined.
 *
 * Deliberately one type. Career writes exactly one kind of fact today: a
 * requirement read off a posting. The professional knowledge the department is
 * meant to own — skills, achievements, experience, applications — is Phase 2,
 * and declaring those types here before anything writes or reads them would be
 * speculative vocabulary, not memory.
 */

import { UNSTRUCTURED } from "../../events/migrate.ts";
import type { UnstructuredFact } from "../../events/migrate.ts";
import type { KnowledgeFact } from "../../events/types.ts";
import { display as displayKnowledge, isKnowledgeFact } from "./knowledge/index.ts";

/** One requirement, as the posting states it. Written by the legacy path only. */
export type JdRequirementFact = KnowledgeFact<"jd_requirement", { statement: string }>;

/**
 * One finding from a fit analysis.
 *
 * Evidence for a report, not knowledge about the representative: it records what
 * the analyst concluded about *this posting*, and `derivedFrom` points at the
 * knowledge that supports it. Bounded by Career's own vocabulary rather than by
 * the length of the posting, so a long posting cannot produce a long report.
 */
export type FitFindingFact = KnowledgeFact<"fit_finding", {
  requirement: string;
  kind: "strong" | "partial" | "gap" | "risk";
  reason: string;
}>;

/** Everything Career can record, plus the legacy shape it may still read. */
export type CareerFact = JdRequirementFact | FitFindingFact | UnstructuredFact;

/**
 * The posting asserts its own requirements.
 *
 * Author is the posting, not the representative who pasted it and not the
 * employee who read it: confidence 1 here means "the posting says this", which
 * is precisely what an external source of record supports.
 */
export const POSTING_AUTHOR = { kind: "external", name: "채용공고" } as const;

/**
 * Narrows a transported fact to something Career understands.
 *
 * Legacy facts arrive as `unstructured` prose, which for Career was always the
 * requirement statement itself — so it reads back cleanly with no parsing. A
 * fact belonging to another department returns null rather than being coerced.
 */
export function asCareerFact(fact: KnowledgeFact): CareerFact | null {
  if (fact.type === "fit_finding") {
    const value = fact.value as Partial<FitFindingFact["value"]>;
    return typeof value?.requirement === "string" ? (fact as FitFindingFact) : null;
  }

  if (fact.type === "jd_requirement") {
    const value = fact.value as Partial<JdRequirementFact["value"]>;
    return typeof value?.statement === "string" ? (fact as JdRequirementFact) : null;
  }

  if (fact.type === UNSTRUCTURED && typeof fact.value === "string") {
    return fact as UnstructuredFact;
  }

  return null;
}

/** The requirement a fact states, however it was stored. */
export function statementOf(fact: KnowledgeFact): string {
  const known = asCareerFact(fact);
  if (!known) return "";

  switch (known.type) {
    case "fit_finding":
      return `${known.value.requirement} — ${known.value.reason}`;
    case "jd_requirement":
      return known.value.statement;
    default:
      return known.value;
  }
}

/**
 * How Career writes a fact for a person to read.
 *
 * The department owns its own phrasing. No surface formats a Career fact, so a
 * new fact type changes this file and nothing in the UI (§4, and Art. 15).
 */
export function display(fact: KnowledgeFact): string {
  // Career Knowledge has its own vocabulary and phrases itself.
  if (isKnowledgeFact(fact)) return displayKnowledge(fact);
  return statementOf(fact);
}
