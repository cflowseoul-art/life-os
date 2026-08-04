/**
 * Where Career's knowledge comes from.
 *
 * The knowledge belongs to the representative, not to this repository and not
 * to the process. Today it is seeded from material one person verified and
 * checked into the tree, which is a fact about how far the product has got —
 * not about who owns it. Nothing that reads knowledge may depend on that
 * arrangement, because it is temporary.
 *
 * So every read goes through this port, and every read names whose knowledge it
 * wants. A consumer cannot tell whether the answer came from the bootstrap
 * seed, a database, replayed events, or a future sync — and cannot obtain
 * anybody's knowledge without saying whose.
 *
 * `load()` then read, rather than an async read, follows the pattern the event
 * store already uses (`EventStore.prepare()` → `load()` → `read()`): a provider
 * fetches once at the edge of a request, and everything downstream stays
 * synchronous. A provider with nothing to fetch resolves immediately.
 */

import { SEEDED_FACTS, SEEDED_GAPS, VERIFIED_AT } from "./seed.ts";
import {
  assertRepresentative,
  describeRepresentative,
  sameRepresentative,
} from "./representative.ts";
import type { RepresentativeKey } from "./representative.ts";
import type { CareerKnowledgeFact, Gap } from "./types.ts";

export interface CareerKnowledgeRepository {
  /** Human-readable provider name. For diagnostics only; never branched on. */
  readonly name: string;

  /**
   * Prepares this representative's knowledge. Called before any read, once per
   * request or process. A provider holding data in memory does nothing here.
   */
  load(representative: RepresentativeKey): Promise<void>;

  /** Everything Career knows about this representative. */
  facts(representative: RepresentativeKey): CareerKnowledgeFact[];

  /** Everything Career knows it does not know about this representative. */
  gaps(representative: RepresentativeKey): Gap[];
}

/**
 * The initial provider: knowledge one representative verified by hand.
 *
 * Bound to exactly one person, named when it is constructed. It refuses anybody
 * else rather than serving what it has — the seeded material is one person's
 * career, and handing it to a second representative would not be a fallback but
 * a disclosure.
 *
 * This is a bootstrap, not the destination. When knowledge becomes writable it
 * moves to a provider that can accept new facts, and this one stays behind as
 * the material a representative starts from. It is deliberately not deleted and
 * deliberately not special — it satisfies the same port as every provider after
 * it, including the identity check.
 */
export class BootstrapRepository implements CareerKnowledgeRepository {
  readonly name = "bootstrap";

  /** When the seeded material was last verified by the representative. */
  readonly verifiedAt = VERIFIED_AT;

  private readonly owner: RepresentativeKey;

  constructor(owner: RepresentativeKey) {
    // Refused at construction, so a misconfigured provider cannot exist at all.
    this.owner = assertRepresentative(owner);
  }

  // `async` so a refusal rejects rather than throwing synchronously: a caller
  // writing `load(rep).catch(...)` must not be hit by an uncaught throw.
  async load(representative: RepresentativeKey): Promise<void> {
    this.mine(representative);
  }

  facts(representative: RepresentativeKey): CareerKnowledgeFact[] {
    this.mine(representative);
    return SEEDED_FACTS;
  }

  gaps(representative: RepresentativeKey): Gap[] {
    this.mine(representative);
    return SEEDED_GAPS;
  }

  /** Every entry point checks. There is no path through this class that skips it. */
  private mine(representative: RepresentativeKey): void {
    const asked = assertRepresentative(representative);

    if (!sameRepresentative(asked, this.owner)) {
      throw new Error(
        `이 지식은 ${describeRepresentative(this.owner)} 대표의 것입니다: `
        + `${describeRepresentative(asked)}에게 드릴 수 없습니다.`,
      );
    }
  }
}

/**
 * A provider holding whatever it is given, for one representative.
 *
 * Exists so a caller — a test, or a future provider composing two sources — can
 * satisfy the port without a store behind it. It is the proof that the port is
 * narrow enough to implement, identity check included.
 */
export class InMemoryRepository implements CareerKnowledgeRepository {
  readonly name = "in-memory";

  private readonly owner: RepresentativeKey;

  constructor(
    owner: RepresentativeKey,
    private readonly held: CareerKnowledgeFact[] = [],
    private readonly missing: Gap[] = [],
  ) {
    this.owner = assertRepresentative(owner);
  }

  // `async` so a refusal rejects rather than throwing synchronously: a caller
  // writing `load(rep).catch(...)` must not be hit by an uncaught throw.
  async load(representative: RepresentativeKey): Promise<void> {
    this.mine(representative);
  }

  facts(representative: RepresentativeKey): CareerKnowledgeFact[] {
    this.mine(representative);
    return this.held;
  }

  gaps(representative: RepresentativeKey): Gap[] {
    this.mine(representative);
    return this.missing;
  }

  private mine(representative: RepresentativeKey): void {
    const asked = assertRepresentative(representative);

    if (!sameRepresentative(asked, this.owner)) {
      throw new Error(
        `이 지식은 ${describeRepresentative(this.owner)} 대표의 것입니다: `
        + `${describeRepresentative(asked)}에게 드릴 수 없습니다.`,
      );
    }
  }
}
