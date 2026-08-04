/**
 * Knowledge that was recorded rather than seeded.
 *
 * The bootstrap seed is material the representative verified once. Everything
 * Career learns *afterwards* — where an application stands, what happened at an
 * interview — arrives as events on their own stream, and this reads it back.
 *
 * Why events rather than a table: history is the point. "No status is
 * overwritten" is not a rule this has to enforce, it is what an append-only log
 * already is. A movement is a new fact; the previous one stays exactly as it was
 * recorded, and the sequence is the history.
 *
 * Reads are ordered by the log, so the last fact for an application is where it
 * stands. A write appended a moment ago is visible to the next read, because
 * there is nothing between them to go stale.
 */

import { isKnowledgeFact } from "./index.ts";
import {
  assertRepresentative,
  describeRepresentative,
  sameRepresentative,
} from "./representative.ts";
import type { RepresentativeKey } from "./representative.ts";
import type { CareerKnowledgeRepository } from "./repository.ts";
import type { CareerKnowledgeFact, Gap } from "./types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

/** The capability whose facts this reads. Another department's are not Career's. */
const CAPABILITY = "career";

export class EventReplayRepository implements CareerKnowledgeRepository {
  readonly name = "event-replay";

  private readonly owner: RepresentativeKey;

  constructor(
    owner: RepresentativeKey,
    private readonly log: EventStream,
  ) {
    this.owner = assertRepresentative(owner);
  }

  // The stream is prepared by the request boundary; nothing to fetch here.
  async load(representative: RepresentativeKey): Promise<void> {
    this.mine(representative);
  }

  /**
   * Career knowledge facts from this representative's stream, in order.
   *
   * Only knowledge facts: the stream also carries a hold's own evidence —
   * fit findings — and those are conclusions about a posting, not knowledge
   * about the representative.
   */
  facts(representative: RepresentativeKey): CareerKnowledgeFact[] {
    this.mine(representative);

    const facts: CareerKnowledgeFact[] = [];

    for (const envelope of this.log.read()) {
      if (envelope.event.type !== "KnowledgeFactRecorded") continue;
      if (envelope.capability !== CAPABILITY) continue;
      if (!isKnowledgeFact(envelope.event.fact)) continue;

      facts.push(envelope.event.fact as CareerKnowledgeFact);
    }

    return facts;
  }

  /** Gaps are declared, not recorded. Nothing on the stream states one. */
  gaps(representative: RepresentativeKey): Gap[] {
    this.mine(representative);
    return [];
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

/**
 * Several providers read as one.
 *
 * Career's knowledge has two origins today — verified seed and recorded events —
 * and a reader should not have to know that. Order is the order given, so
 * anything recorded later appears after anything seeded, which is what makes the
 * last fact for an application the current one.
 */
export class CompositeRepository implements CareerKnowledgeRepository {
  readonly name = "composite";

  constructor(private readonly parts: CareerKnowledgeRepository[]) {}

  async load(representative: RepresentativeKey): Promise<void> {
    for (const part of this.parts) await part.load(representative);
  }

  facts(representative: RepresentativeKey): CareerKnowledgeFact[] {
    return this.parts.flatMap((part) => part.facts(representative));
  }

  gaps(representative: RepresentativeKey): Gap[] {
    return this.parts.flatMap((part) => part.gaps(representative));
  }
}
