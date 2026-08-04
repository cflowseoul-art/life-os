/**
 * Which ontology serves an authenticated representative.
 *
 * One function, no state, mirroring how knowledge is resolved. The vocabulary
 * follows the same person as the record it describes, and the same binding
 * decides both: the representative the seeded material belongs to gets the
 * seeded vocabulary, and everybody else starts empty.
 *
 * Empty is a real answer. A representative with no ontology resolves no terms,
 * which is exactly right — they have no record for those terms to be about.
 */

import { BootstrapOntologyRepository, InMemoryOntologyRepository } from "./repository.ts";
import { careerOntology } from "./index.ts";
import { ownsBootstrapKnowledge } from "../knowledge/bootstrap.ts";
import { representativeOf } from "../knowledge/representative.ts";
import type { CareerOntology } from "./index.ts";
import type { CareerOntologyRepository } from "./repository.ts";
import type { ActorContext } from "../../../identity/types.ts";

export function ontologyRepositoryFor(actor: ActorContext): CareerOntologyRepository {
  const representative = representativeOf(actor);

  return ownsBootstrapKnowledge(actor)
    ? new BootstrapOntologyRepository(representative)
    : new InMemoryOntologyRepository(representative);
}

/** One authenticated representative's vocabulary. Never anybody else's. */
export function careerOntologyFor(actor: ActorContext): CareerOntology {
  return careerOntology(ontologyRepositoryFor(actor), representativeOf(actor));
}
