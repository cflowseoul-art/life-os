/**
 * Career Knowledge — the store every Career employee reads.
 *
 * One store, not one per employee. The job fit analyst, the strategist, the
 * résumé editor and the interview coach all read exactly these facts, so two
 * Career employees can never hold different beliefs about the representative.
 *
 * Read-only by design in this phase. The seeded material was verified by the
 * representative and is durable in the repository; how *new* knowledge is
 * written — a recruiter's feedback, an interview that happened — is a decision
 * that has not been made, and guessing at it would put a write path into the
 * one store that must not accumulate unverified claims.
 *
 * The rule that gives this module its purpose:
 *
 *   **No Career employee may ask the representative for something Career
 *   already holds.** `owns()` is how an employee checks, and `gapsIn()` is what
 *   they report instead of asking or inventing.
 */

import { CATEGORY_OF, KNOWLEDGE_CATEGORIES } from "./types.ts";
import type {
  CareerKnowledgeFact,
  CareerKnowledgeType,
  Gap,
  KnowledgeCategory,
} from "./types.ts";
import { SEEDED_FACTS, SEEDED_GAPS, VERIFIED_AT } from "./seed.ts";
import type { KnowledgeFact } from "../../../events/types.ts";

export type { CareerKnowledgeFact, Gap, KnowledgeCategory } from "./types.ts";
export { KNOWLEDGE_CATEGORIES, CATEGORY_OF } from "./types.ts";
export { VERIFIED_AT } from "./seed.ts";

/** Everything Career knows, in the order it was verified. */
export function knowledge(): CareerKnowledgeFact[] {
  return SEEDED_FACTS;
}

/** Everything Career knows it does not know. */
export function gaps(): Gap[] {
  return SEEDED_GAPS;
}

/** Facts of one type. */
export function factsOfType<T extends CareerKnowledgeType>(
  type: T,
): Extract<CareerKnowledgeFact, { type: T }>[] {
  return SEEDED_FACTS.filter(
    (f): f is Extract<CareerKnowledgeFact, { type: T }> => f.type === type,
  );
}

/** Facts answering for one category. */
export function factsIn(category: KnowledgeCategory): CareerKnowledgeFact[] {
  return SEEDED_FACTS.filter((f) => CATEGORY_OF[f.type] === category);
}

/** What is missing in one category. */
export function gapsIn(category: KnowledgeCategory): Gap[] {
  return SEEDED_GAPS.filter((g) => g.category === category);
}

/**
 * Whether Career already holds knowledge in this category.
 *
 * An employee checks this before asking the representative anything. True means
 * the answer is already here and asking would be asking twice.
 */
export function owns(category: KnowledgeCategory): boolean {
  return factsIn(category).length > 0;
}

/** One fact by the id it was verified under — `ACH-001`, `SKL-004`, `EXP-002`. */
export function byId(id: string): CareerKnowledgeFact | null {
  return SEEDED_FACTS.find((f) => f.id === id) ?? null;
}

/**
 * Every limit the record carries.
 *
 * Experiences and projects record what they do *not* support, and the skills
 * list records what may not be claimed at all. Collected here because a
 * consumer that reads a fact and misses its limit is exactly how a verified
 * experience becomes an overstatement.
 */
export function prohibitions(): string[] {
  return [
    ...factsOfType("prohibited_claim").map((f) => f.value.claim),
    ...factsOfType("experience").map((f) => f.value.limits),
    ...factsOfType("project").map((f) => f.value.limits),
  ];
}

/** What Career holds and lacks, category by category. For reporting, not logic. */
export function coverage(): { category: KnowledgeCategory; facts: number; gaps: number }[] {
  return KNOWLEDGE_CATEGORIES.map((category) => ({
    category,
    facts: factsIn(category).length,
    gaps: gapsIn(category).length,
  }));
}

/**
 * How Career writes one of its knowledge facts for a person to read.
 *
 * Career owns the phrasing of its own vocabulary, exactly as it does for the
 * facts it records against a hold.
 */
export function display(fact: KnowledgeFact): string {
  const known = SEEDED_FACTS.find((f) => f.id === fact.id && f.type === fact.type);
  const subject = (known ?? fact) as CareerKnowledgeFact;

  switch (subject.type) {
    case "profile":
      return `${subject.value.field} · ${subject.value.value}`;
    case "employment":
      return `${subject.value.employer} · ${subject.value.title} · ${subject.value.period}`;
    case "experience":
      return `${subject.value.title} · ${subject.value.period}`;
    case "project":
      return `${subject.value.title} · ${subject.value.period}`;
    case "achievement":
      return subject.value.statement;
    case "skill":
      return `${subject.value.name} · ${subject.value.safeWording}`;
    case "prohibited_claim":
      return `주장 불가 · ${subject.value.claim}`;
    case "strength":
      return subject.value.statement;
    case "weakness":
      return subject.value.statement;
    case "preferred_role":
      return subject.value.role;
    case "interview_question":
      return subject.value.question;
    case "interview_story":
      return `${subject.value.title} · ${subject.value.narrative}`;
  }
}

/** True when this fact belongs to Career Knowledge rather than to a hold. */
export function isKnowledgeFact(fact: KnowledgeFact): boolean {
  return Object.hasOwn(CATEGORY_OF, fact.type);
}
