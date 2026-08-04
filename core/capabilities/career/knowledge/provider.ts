/**
 * Which knowledge provider serves an authenticated representative.
 *
 * One function, no state. There is no resolver to install, nothing to restore
 * afterwards, and no order-dependent behaviour — the same actor always gets the
 * same provider, and two requests in flight cannot see each other's.
 *
 * The previous version kept a module-level resolver that tests swapped in and
 * out. That made "whose knowledge does this return?" a question about what had
 * run before, which is exactly the wrong property for the store that holds one
 * person's career.
 *
 * Every representative gets a view. A representative the seed does not describe
 * gets an **empty** one — scoped to them, holding nothing — rather than null or
 * somebody else's facts. Career then reports that it knows nothing about them,
 * which is true, instead of quietly answering with a stranger's history.
 */

import { BootstrapRepository, InMemoryRepository } from "./repository.ts";
import { CompositeRepository, EventReplayRepository } from "./event-repository.ts";
import { careerKnowledge } from "./index.ts";
import { ownsBootstrapKnowledge } from "./bootstrap.ts";
import { representativeOf } from "./representative.ts";
import type { CareerKnowledge } from "./index.ts";
import type { CareerKnowledgeRepository } from "./repository.ts";
import type { RepresentativeKey } from "./representative.ts";
import type { ActorContext } from "../../../identity/types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

/**
 * The provider for one authenticated representative.
 *
 * Throws when the request carries no usable identity: a read that cannot name
 * whose knowledge it wants must not proceed, because the store it would reach
 * has no safe default.
 */
export function knowledgeRepositoryFor(
  actor: ActorContext,
  log?: EventStream,
): CareerKnowledgeRepository {
  const representative: RepresentativeKey = representativeOf(actor);

  const seeded = ownsBootstrapKnowledge(actor)
    ? new BootstrapRepository(representative)
    : new InMemoryRepository(representative);

  // Verified material first, then whatever Career has recorded since. Order is
  // what makes the last fact about an application the current one.
  return log
    ? new CompositeRepository([seeded, new EventReplayRepository(representative, log)])
    : seeded;
}

/**
 * One authenticated representative's Career Knowledge. Never anybody else's.
 *
 * Given a stream, what has been recorded is read alongside what was seeded — so
 * a fact written a moment ago is visible to the next read.
 */
export function careerKnowledgeFor(actor: ActorContext, log?: EventStream): CareerKnowledge {
  return careerKnowledge(knowledgeRepositoryFor(actor, log), representativeOf(actor));
}
