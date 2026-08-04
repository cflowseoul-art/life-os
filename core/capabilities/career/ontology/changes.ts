/**
 * Approved changes to the vocabulary.
 *
 * The seeded ontology is what the representative's record already named. This
 * is everything they have approved since — recorded on their own stream, so
 * scoping, ordering and provenance are the ones already established.
 *
 * Every change is authored by the **representative**. Not by the employee that
 * noticed the term, and not by the system that proposed a shape for it: an
 * ontology entry is a claim about what a word means, and only an approval makes
 * that claim. A proposal is `derivedFrom`, never an author.
 *
 * Changes are append-only. A term is never edited in place; a later change
 * supersedes an earlier one, and the sequence is how the vocabulary got here.
 */

import { ontologyProblems } from "./types.ts";
import type {
  Label,
  OntologySnapshot,
  OntologyVersion,
  Relation,
  Term,
} from "./types.ts";
import type { CareerOntologyRepository } from "./repository.ts";
import {
  assertRepresentative,
  describeRepresentative,
  sameRepresentative,
} from "../knowledge/representative.ts";
import type { RepresentativeKey } from "../knowledge/representative.ts";
import type { KnowledgeFact } from "../../../events/types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

export const ONTOLOGY_CHANGE_TYPE = "ontology_change";

/**
 * One approved addition to the vocabulary.
 *
 * `CATEGORY_OF` has no entry for this type, so `isKnowledgeFact` is false and
 * Career Knowledge skips it. The vocabulary is not something Career knows about
 * the representative; it is what their words mean.
 */
export type OntologyChangeFact = KnowledgeFact<"ontology_change", {
  /** The version the vocabulary reaches once this change is applied. */
  version: OntologyVersion;
  terms: Term[];
  labels: Label[];
  relations: Relation[];
  /** The candidate this settled, so a term traces back to the word that raised it. */
  settled: string[];
}>;

/** Every approved change on this stream, oldest first. */
export function changeFacts(log: EventStream): OntologyChangeFact[] {
  const facts: OntologyChangeFact[] = [];

  for (const envelope of log.read()) {
    if (envelope.event.type !== "KnowledgeFactRecorded") continue;
    if (envelope.capability !== "career") continue;
    if (envelope.event.fact.type !== ONTOLOGY_CHANGE_TYPE) continue;

    facts.push(envelope.event.fact as OntologyChangeFact);
  }

  return facts;
}

/** The version the vocabulary stands at after everything approved so far. */
export function currentVersion(base: OntologyVersion, log: EventStream): OntologyVersion {
  return changeFacts(log).reduce((highest, fact) => Math.max(highest, fact.value.version), base);
}

/**
 * The seeded vocabulary plus everything approved since.
 *
 * Order is seed first, then approvals in the order they were made, so a later
 * label supersedes an earlier one by being found later — the same rule that
 * makes the last application fact the current one.
 */
export class ApprovedOntologyRepository implements CareerOntologyRepository {
  readonly name = "approved-ontology";

  private readonly owner: RepresentativeKey;

  constructor(
    owner: RepresentativeKey,
    private readonly base: CareerOntologyRepository,
    private readonly log: EventStream,
  ) {
    this.owner = assertRepresentative(owner);
  }

  async load(representative: RepresentativeKey): Promise<void> {
    this.mine(representative);
    await this.base.load(representative);
  }

  snapshot(representative: RepresentativeKey): OntologySnapshot {
    this.mine(representative);

    const seeded = this.base.snapshot(representative);
    const changes = changeFacts(this.log);

    const merged: OntologySnapshot = {
      version: changes.reduce((v, c) => Math.max(v, c.value.version), seeded.version),
      terms: [...seeded.terms, ...changes.flatMap((c) => c.value.terms)],
      labels: [...seeded.labels, ...changes.flatMap((c) => c.value.labels)],
      relations: [...seeded.relations, ...changes.flatMap((c) => c.value.relations)],
    };

    return merged;
  }

  private mine(representative: RepresentativeKey): void {
    const asked = assertRepresentative(representative);

    if (!sameRepresentative(asked, this.owner)) {
      throw new Error(
        `이 용어 체계는 ${describeRepresentative(this.owner)} 대표의 것입니다: `
        + `${describeRepresentative(asked)}에게 드릴 수 없습니다.`,
      );
    }
  }
}

/**
 * Records an approved change, refusing one that would break the vocabulary.
 *
 * The check runs against the vocabulary *as it would be*, not as it is. A label
 * that would reach two terms is rejected before it is written rather than
 * discovered at the next lookup — which is how a duplicated concept becomes two
 * half-populated entries nobody can tell apart.
 */
export function recordChange(
  input: { log: EventStream; holdId: string; before: OntologySnapshot },
  change: { terms: Term[]; labels: Label[]; relations: Relation[]; settled: string[] },
): { ok: true; version: OntologyVersion } | { ok: false; reasons: string[] } {
  const version = input.before.version + 1;

  const after: OntologySnapshot = {
    version,
    terms: [...input.before.terms, ...change.terms],
    labels: [...input.before.labels, ...change.labels],
    relations: [...input.before.relations, ...change.relations],
  };

  const problems = ontologyProblems(after);
  if (problems.length > 0) return { ok: false, reasons: problems };

  input.log.append(
    {
      type: "KnowledgeFactRecorded",
      holdId: input.holdId,
      fact: {
        id: `ontology-${String(version)}`,
        type: ONTOLOGY_CHANGE_TYPE,
        value: { version, ...change },
        source: "대표님 승인",
        // Only an approval claims what a word means.
        author: { kind: "representative" },
        acquiredAt: new Date().toISOString(),
        confidence: 1,
      },
    },
    { kind: "capability", id: "career" },
    "career",
    "career:ontology",
  );

  return { ok: true, version };
}
