/**
 * The Career Ontology — one view every Career employee resolves through.
 *
 * The Job Fit Analyst, and later the Résumé Editor, Portfolio Editor and
 * Interview Coach, all ask the same question here: what does this word mean?
 * Sharing the vocabulary by construction is what stops each of them growing a
 * private list of synonyms that quietly disagree.
 *
 * Resolution is by label, and every label of a term returns that same term. So
 * `Data Modeling` and `데이터 모델링` are one concept, held once.
 */

import { normaliseLabel } from "./types.ts";
import type {
  Label,
  OntologySnapshot,
  OntologyVersion,
  Relation,
  RelationKind,
  Term,
  TermId,
  TermKind,
} from "./types.ts";
import type { CareerOntologyRepository } from "./repository.ts";
import type { RepresentativeKey } from "../knowledge/representative.ts";

export type { Label, OntologyVersion, Relation, Term, TermId, TermKind } from "./types.ts";
export { normaliseLabel, ontologyProblems } from "./types.ts";
export type { OntologySnapshot } from "./types.ts";
export {
  BootstrapOntologyRepository,
  InMemoryOntologyRepository,
} from "./repository.ts";
export type { CareerOntologyRepository } from "./repository.ts";

export type CareerOntology = {
  /** Whose vocabulary this is. Fixed when the view is built. */
  readonly representative: RepresentativeKey;
  /** What the vocabulary stands at. Recorded by anything computed against it. */
  version(): OntologyVersion;
  terms(): Term[];
  termsOfKind(kind: TermKind): Term[];
  /** One term by id, following a merge. Null when nothing answers to it. */
  byId(id: TermId): Term | null;
  /** The term a word names, whichever of its labels was used. */
  resolve(text: string): Term | null;
  labelsOf(id: TermId): Label[];
  /** What to call a term. The locale's canonical label, else any canonical. */
  nameOf(id: TermId, locale?: Label["locale"]): string;
  related(id: TermId, kind: RelationKind): Term[];
  /**
   * Every term this text names.
   *
   * The posting is asked yes-or-no about each label the vocabulary holds — it
   * never contributes a term of its own, and repeating a word cannot make it
   * count twice.
   */
  mentionedIn(text: string): Set<TermId>;
};

export function careerOntology(
  repository: CareerOntologyRepository,
  representative: RepresentativeKey,
): CareerOntology {
  const read = (): OntologySnapshot => repository.snapshot(representative);

  /** Follows a merge to whatever now answers for it. */
  const settle = (term: Term | undefined, terms: Term[]): Term | null => {
    let current = term;
    const seen = new Set<TermId>();

    while (current?.status === "merged" && current.mergedInto) {
      if (seen.has(current.id)) return null;
      seen.add(current.id);
      current = terms.find((t) => t.id === current?.mergedInto);
    }

    return current ?? null;
  };

  const byId = (id: TermId): Term | null => {
    const { terms } = read();
    return settle(terms.find((t) => t.id === id), terms);
  };

  return {
    representative,
    version: () => read().version,
    terms: () => read().terms,
    termsOfKind: (kind) => read().terms.filter((t) => t.kind === kind),
    byId,

    resolve: (text) => {
      const { terms, labels } = read();
      const key = normaliseLabel(text);
      if (key === "") return null;

      const label = labels.find((l) => normaliseLabel(l.text) === key);
      return label ? settle(terms.find((t) => t.id === label.termId), terms) : null;
    },

    labelsOf: (id) => read().labels.filter((l) => l.termId === id),

    nameOf: (id, locale) => {
      const labels = read().labels.filter((l) => l.termId === id);
      const canonical = labels.filter((l) => l.role === "canonical");

      return (
        canonical.find((l) => l.locale === locale)?.text
        ?? canonical[0]?.text
        ?? labels[0]?.text
        ?? id
      );
    },

    related: (id, kind) => {
      const { terms, relations } = read();

      return relations
        .filter((r: Relation) => r.kind === kind && r.from === id)
        .flatMap((r) => {
          const found = settle(terms.find((t) => t.id === r.to), terms);
          return found ? [found] : [];
        });
    },

    mentionedIn: (text) => {
      const { terms, labels } = read();
      const haystack = normaliseLabel(text);
      const found = new Set<TermId>();

      for (const label of labels) {
        const needle = normaliseLabel(label.text);
        // A one-character label would match almost anything.
        if (needle.length < 2 || !haystack.includes(needle)) continue;

        const term = settle(terms.find((t) => t.id === label.termId), terms);
        if (term && term.status !== "deprecated") found.add(term.id);
      }

      return found;
    },
  };
}

/** An ontology holding nothing. What a representative has before approving any. */
export function emptyOntology(representative: RepresentativeKey): CareerOntology {
  return careerOntology(
    {
      name: "empty",
      load: () => Promise.resolve(),
      snapshot: () => ({ version: 0, terms: [], labels: [], relations: [] }),
    },
    representative,
  );
}
