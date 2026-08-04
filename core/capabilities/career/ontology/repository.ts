/**
 * Where the Career Ontology comes from.
 *
 * The same port shape as Career Knowledge, for the same reason: a reader asks
 * for the vocabulary and cannot tell whether it was seeded, stored, or replayed
 * from approved changes. Learning will arrive as another provider behind this
 * interface, and nothing above it will notice.
 *
 * Scoped to one representative. An ontology grows out of the postings one
 * person hands over and the terms they approve, so it is shaped by their
 * market — treating it as shared would hand one person's vocabulary, and the
 * assumptions in it, to somebody else.
 */

import { ontologyProblems } from "./types.ts";
import { SEEDED_ONTOLOGY } from "./seed.ts";
import {
  assertRepresentative,
  describeRepresentative,
  sameRepresentative,
} from "../knowledge/representative.ts";
import type { RepresentativeKey } from "../knowledge/representative.ts";
import type { OntologySnapshot, OntologyVersion } from "./types.ts";

export interface CareerOntologyRepository {
  /** Human-readable provider name. For diagnostics only; never branched on. */
  readonly name: string;

  /** Prepares this representative's ontology. Called before any read. */
  load(representative: RepresentativeKey): Promise<void>;

  /** The vocabulary as it stands, with the version it stands at. */
  snapshot(representative: RepresentativeKey): OntologySnapshot;
}

/** Refuses to serve anybody but the representative it was built for. */
abstract class ScopedOntologyRepository implements CareerOntologyRepository {
  abstract readonly name: string;

  protected readonly owner: RepresentativeKey;

  constructor(owner: RepresentativeKey) {
    this.owner = assertRepresentative(owner);
  }

  async load(representative: RepresentativeKey): Promise<void> {
    this.mine(representative);
  }

  abstract snapshot(representative: RepresentativeKey): OntologySnapshot;

  protected mine(representative: RepresentativeKey): void {
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
 * The initial vocabulary: the tools the representative's record already names.
 *
 * Checked when it is constructed rather than when it is first read. A
 * vocabulary where one label reaches two concepts is unusable, and finding that
 * out at lookup time means finding out during a fit analysis.
 */
export class BootstrapOntologyRepository extends ScopedOntologyRepository {
  readonly name = "bootstrap-ontology";

  constructor(owner: RepresentativeKey) {
    super(owner);

    const problems = ontologyProblems(SEEDED_ONTOLOGY);
    if (problems.length > 0) {
      throw new Error(`용어 체계가 올바르지 않습니다:\n  - ${problems.join("\n  - ")}`);
    }
  }

  snapshot(representative: RepresentativeKey): OntologySnapshot {
    this.mine(representative);
    return SEEDED_ONTOLOGY;
  }
}

/**
 * A vocabulary holding whatever it is given.
 *
 * Proof that the port is narrow enough to implement, and the empty ontology a
 * representative starts with before anything is approved.
 */
export class InMemoryOntologyRepository extends ScopedOntologyRepository {
  readonly name = "in-memory-ontology";

  private readonly held: OntologySnapshot;

  constructor(owner: RepresentativeKey, snapshot?: Partial<OntologySnapshot>) {
    super(owner);

    this.held = {
      version: snapshot?.version ?? 0,
      terms: snapshot?.terms ?? [],
      labels: snapshot?.labels ?? [],
      relations: snapshot?.relations ?? [],
    };

    const problems = ontologyProblems(this.held);
    if (problems.length > 0) {
      throw new Error(`용어 체계가 올바르지 않습니다:\n  - ${problems.join("\n  - ")}`);
    }
  }

  snapshot(representative: RepresentativeKey): OntologySnapshot {
    this.mine(representative);
    return this.held;
  }
}
