/**
 * Which knowledge provider serves a representative.
 *
 * The one place the current arrangement is named. Career code asks for a
 * representative's knowledge and gets a view or nothing; it never learns that a
 * bootstrap seed exists, and it never receives somebody else's knowledge because
 * the configured one was closer to hand.
 *
 * The bootstrap seed belongs to exactly one person. Who that is cannot be
 * inferred — the material carries no identity, and the real household and user
 * ids are minted at onboarding — so it is configuration. Unconfigured means no
 * knowledge, which the analyst reports as such. It never means everyone's.
 */

import { BootstrapRepository } from "./repository.ts";
import { careerKnowledge } from "./index.ts";
import { sameRepresentative } from "./representative.ts";
import type { CareerKnowledge } from "./index.ts";
import type { CareerKnowledgeRepository } from "./repository.ts";
import type { RepresentativeKey } from "./representative.ts";

/** Who the seeded material belongs to, or null when nobody has claimed it. */
export function configuredOwner(): RepresentativeKey | null {
  const householdId = (process.env.LIFE_OS_CAREER_HOUSEHOLD_ID ?? "").trim();
  const userId = (process.env.LIFE_OS_CAREER_USER_ID ?? "").trim();

  if (householdId === "" || userId === "") return null;
  return { householdId, userId };
}

/** Resolves the provider for one representative, or null when none serves them. */
export type KnowledgeResolver = (
  representative: RepresentativeKey,
) => CareerKnowledgeRepository | null;

const bootstrapResolver: KnowledgeResolver = (representative) => {
  const owner = configuredOwner();
  if (!owner) return null;
  if (!sameRepresentative(owner, representative)) return null;

  return new BootstrapRepository(owner);
};

let resolver: KnowledgeResolver = bootstrapResolver;

/**
 * Replaces how providers are resolved.
 *
 * The composition seam. A runner cannot be handed a repository — the runner port
 * carries an actor, a log, and the request, and widening it would change a layer
 * this work does not own. Returns the previous resolver so a caller can restore
 * it.
 */
export function useKnowledgeResolver(next: KnowledgeResolver): KnowledgeResolver {
  const previous = resolver;
  resolver = next;
  return previous;
}

/**
 * One representative's knowledge, or null when Career holds none for them.
 *
 * Null is a real answer and the analyst reports it. It is never substituted with
 * whatever knowledge happens to be loaded.
 */
export function knowledgeFor(representative: RepresentativeKey): CareerKnowledge | null {
  const repository = resolver(representative);
  return repository ? careerKnowledge(repository, representative) : null;
}
