/**
 * Where Career's knowledge comes from.
 *
 * The knowledge belongs to the representative, not to this repository. Today it
 * is seeded from material they verified and checked into the tree, which is a
 * fact about how far the product has got — not about who owns it. Nothing that
 * reads knowledge may depend on that arrangement, because it is temporary.
 *
 * So every read goes through this port. A consumer asks for facts and gaps and
 * cannot tell whether they came from the bootstrap seed, a database, replayed
 * events, or a future sync.
 *
 * `load()` then read, rather than an async read, follows the pattern the event
 * store already uses (`EventStore.prepare()` → `load()` → `read()`): a provider
 * fetches once at the edge of a request, and everything downstream stays
 * synchronous. A provider with nothing to fetch resolves immediately.
 */

import { SEEDED_FACTS, SEEDED_GAPS, VERIFIED_AT } from "./seed.ts";
import type { CareerKnowledgeFact, Gap } from "./types.ts";

export interface CareerKnowledgeRepository {
  /** Human-readable provider name. For diagnostics only; never branched on. */
  readonly name: string;

  /**
   * Prepares the provider. Called before any read, once per request or process.
   * A provider that holds its data in memory does nothing here.
   */
  load(): Promise<void>;

  /** Everything Career knows. */
  facts(): CareerKnowledgeFact[];

  /** Everything Career knows it does not know. */
  gaps(): Gap[];
}

/**
 * The initial provider: knowledge the representative verified by hand.
 *
 * This is a bootstrap, not the destination. When knowledge becomes writable it
 * moves to a provider that can accept new facts, and this one stays behind as
 * the material a fresh representative starts from. It is deliberately not
 * deleted and deliberately not special — it satisfies the same port as every
 * provider after it.
 */
export class BootstrapRepository implements CareerKnowledgeRepository {
  readonly name = "bootstrap";

  /** When the seeded material was last verified by the representative. */
  readonly verifiedAt = VERIFIED_AT;

  load(): Promise<void> {
    // Nothing to fetch: the material is already in memory.
    return Promise.resolve();
  }

  facts(): CareerKnowledgeFact[] {
    return SEEDED_FACTS;
  }

  gaps(): Gap[] {
    return SEEDED_GAPS;
  }
}

/**
 * A provider holding whatever it is given.
 *
 * Exists so a caller — a test, or a future provider composing two sources — can
 * satisfy the port without a store behind it. It is the proof that the port is
 * narrow enough to implement.
 */
export class InMemoryRepository implements CareerKnowledgeRepository {
  readonly name = "in-memory";

  constructor(
    private readonly held: CareerKnowledgeFact[] = [],
    private readonly missing: Gap[] = [],
  ) {}

  load(): Promise<void> {
    return Promise.resolve();
  }

  facts(): CareerKnowledgeFact[] {
    return this.held;
  }

  gaps(): Gap[] {
    return this.missing;
  }
}
