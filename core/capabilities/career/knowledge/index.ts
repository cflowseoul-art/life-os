/**
 * Career Knowledge — the one view every Career employee reads.
 *
 * One store, not one per employee. The job fit analyst, the strategist, the
 * résumé editor and the interview coach all read exactly these facts, so two
 * Career employees can never hold different beliefs about the representative.
 *
 * Everything here reads through a `CareerKnowledgeRepository`. Nothing in this
 * file knows where the knowledge came from, and nothing outside `repository.ts`
 * knows the bootstrap seed exists — swapping the provider changes no Career
 * logic and no query below.
 *
 * The rule that gives this module its purpose:
 *
 *   **No Career employee may ask the representative for something Career
 *   already holds.** `owns()` is how an employee checks, and `gapsIn()` is what
 *   they report instead of asking or inventing.
 */

import { CATEGORY_OF, KNOWLEDGE_CATEGORIES, STATUS_LABEL } from "./types.ts";
import type {
  CareerKnowledgeFact,
  CareerKnowledgeType,
  Gap,
  KnowledgeCategory,
} from "./types.ts";
import type { CareerKnowledgeRepository } from "./repository.ts";
import { assertRepresentative } from "./representative.ts";
import type { RepresentativeKey } from "./representative.ts";
import type { KnowledgeFact } from "../../../events/types.ts";

export type {
  ApplicationFact,
  ApplicationStatus,
  CareerKnowledgeFact,
  Gap,
  KnowledgeCategory,
} from "./types.ts";
export { APPLICATION_STATUSES, CATEGORY_OF, KNOWLEDGE_CATEGORIES, STATUS_LABEL } from "./types.ts";
export { BootstrapRepository, InMemoryRepository } from "./repository.ts";
export type { CareerKnowledgeRepository } from "./repository.ts";
export {
  assertRepresentative,
  describeRepresentative,
  representativeOf,
  sameRepresentative,
} from "./representative.ts";
export type { RepresentativeKey } from "./representative.ts";

/** Everything a Career employee may ask of the representative's knowledge. */
export type CareerKnowledge = {
  /** Whose knowledge this view reads. Fixed when the view is built. */
  readonly representative: RepresentativeKey;
  /** Everything Career knows. */
  facts(): CareerKnowledgeFact[];
  /** Everything Career knows it does not know. */
  gaps(): Gap[];
  factsOfType<T extends CareerKnowledgeType>(type: T): Extract<CareerKnowledgeFact, { type: T }>[];
  factsIn(category: KnowledgeCategory): CareerKnowledgeFact[];
  gapsIn(category: KnowledgeCategory): Gap[];
  /**
   * Whether Career already holds knowledge in this category.
   *
   * An employee checks this before asking the representative anything. True
   * means the answer is already here and asking would be asking twice.
   */
  owns(category: KnowledgeCategory): boolean;
  /** One fact by the id it was verified under — `ACH-001`, `SKL-004`, `EXP-002`. */
  byId(id: string): CareerKnowledgeFact | null;
  /**
   * Every limit the record carries.
   *
   * Experiences and projects record what they do *not* support, and the skills
   * list records what may not be claimed at all. Collected here because a
   * consumer that reads a fact and misses its limit is exactly how a verified
   * experience becomes an overstatement.
   */
  prohibitions(): string[];
  /** What Career holds and lacks, category by category. For reporting, not logic. */
  coverage(): { category: KnowledgeCategory; facts: number; gaps: number }[];
};

/**
 * One representative's knowledge, read through one provider.
 *
 * The representative is named once, here, and carried into every read — so a
 * query cannot be written that forgets to scope itself, and there is no view
 * that means "everyone". A malformed key is refused before the provider is
 * touched.
 *
 * Every query re-reads from the repository rather than snapshotting, so a
 * provider backed by a live store is never serving a stale view. Caching, if a
 * provider needs it, is the provider's business.
 */
export function careerKnowledge(
  repository: CareerKnowledgeRepository,
  representative: RepresentativeKey,
): CareerKnowledge {
  const whose = assertRepresentative(representative);

  const factsIn = (category: KnowledgeCategory): CareerKnowledgeFact[] =>
    repository.facts(whose).filter((f) => CATEGORY_OF[f.type] === category);

  const gapsIn = (category: KnowledgeCategory): Gap[] =>
    repository.gaps(whose).filter((g) => g.category === category);

  const factsOfType = <T extends CareerKnowledgeType>(
    type: T,
  ): Extract<CareerKnowledgeFact, { type: T }>[] =>
    repository.facts(whose).filter(
      (f): f is Extract<CareerKnowledgeFact, { type: T }> => f.type === type,
    );

  return {
    representative: whose,
    facts: () => repository.facts(whose),
    gaps: () => repository.gaps(whose),
    factsOfType,
    factsIn,
    gapsIn,
    owns: (category) => factsIn(category).length > 0,
    byId: (id) => repository.facts(whose).find((f) => f.id === id) ?? null,
    prohibitions: () => [
      ...factsOfType("prohibited_claim").map((f) => f.value.claim),
      ...factsOfType("experience").map((f) => f.value.limits),
      ...factsOfType("project").map((f) => f.value.limits),
    ],
    coverage: () =>
      KNOWLEDGE_CATEGORIES.map((category) => ({
        category,
        facts: factsIn(category).length,
        gaps: gapsIn(category).length,
      })),
  };
}

/**
 * How Career writes one of its knowledge facts for a person to read.
 *
 * Career owns the phrasing of its own vocabulary, exactly as it does for the
 * facts it records against a hold. Deliberately takes only the fact: formatting
 * needs no store, so display works on a fact from any provider — or on one that
 * came from nowhere at all.
 */
export function display(fact: KnowledgeFact): string {
  const subject = fact as CareerKnowledgeFact;

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
    case "application":
      return `${subject.value.company} · ${subject.value.position} · ${STATUS_LABEL[subject.value.status]}`;
  }
}

/** True when this fact belongs to Career Knowledge rather than to a hold. */
export function isKnowledgeFact(fact: KnowledgeFact): boolean {
  return Object.hasOwn(CATEGORY_OF, fact.type);
}
