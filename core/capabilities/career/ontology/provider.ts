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
import { ApprovedOntologyRepository } from "./changes.ts";
import { careerOntology } from "./index.ts";
import { ownsBootstrapKnowledge } from "../knowledge/bootstrap.ts";
import { representativeOf } from "../knowledge/representative.ts";
import type { CareerOntology } from "./index.ts";
import type { CareerOntologyRepository } from "./repository.ts";
import type { ActorContext } from "../../../identity/types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

export function ontologyRepositoryFor(
  actor: ActorContext,
  log?: EventStream,
): CareerOntologyRepository {
  const representative = representativeOf(actor);

  const seeded = ownsBootstrapKnowledge(actor)
    ? new BootstrapOntologyRepository(representative)
    : new InMemoryOntologyRepository(representative);

  // Seeded first, approvals after, so a later label supersedes an earlier one.
  return log ? new ApprovedOntologyRepository(representative, seeded, log) : seeded;
}

/**
 * One authenticated representative's vocabulary. Never anybody else's.
 *
 * Given a stream, everything they have approved reads alongside what was
 * seeded — so a term approved a moment ago resolves on the next posting.
 */
export function careerOntologyFor(actor: ActorContext, log?: EventStream): CareerOntology {
  return careerOntology(ontologyRepositoryFor(actor, log), representativeOf(actor));
}
