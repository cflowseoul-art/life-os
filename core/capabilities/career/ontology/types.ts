/**
 * The Career Ontology — what terms mean.
 *
 * Career Knowledge records what the representative has done. This records what
 * the words mean, so two employees reading "Data Modeling" and "데이터 모델링"
 * are reading about the same thing.
 *
 * The join between the two is `TermId`. It is opaque, permanent, and never a
 * label: renaming a concept adds a label, and merging two concepts redirects an
 * id. Evidence points at ids, so neither operation moves anything downstream.
 *
 * Nothing here ships as a library. A term exists because it appeared in the
 * representative's own record or in a posting they handed over — never because
 * somebody guessed it would be useful.
 */

/** Opaque and permanent. Never derived from a label, never reused. */
export type TermId = string;

/**
 * What a term is, per ADR-025.
 *
 * Only `tool` is populated today. Capability and vocabulary exist in the type
 * because the ontology has to be able to hold them before anything migrates,
 * and a discriminator added later would be a breaking change to every stored
 * term.
 */
export type TermKind = "capability" | "tool" | "vocabulary";

export type TermStatus = "active" | "deprecated" | "merged";

/** `und` is a label that is the same in both languages — `SQL`, `Tableau`. */
export type Locale = "ko" | "en" | "und";

export type LabelRole = "canonical" | "alias" | "abbreviation";

export type Term = {
  id: TermId;
  kind: TermKind;
  status: TermStatus;
  /** Set only when `status` is `merged`. Resolution follows it. */
  mergedInto: TermId | null;
  /** The ontology version this term entered at. */
  since: OntologyVersion;
  /** The version it left at, when deprecated. Null while it is current. */
  until: OntologyVersion | null;
};

/**
 * One way of naming a term.
 *
 * A concept has one canonical label per locale and any number of aliases. This
 * is the whole answer to holding Korean and English without duplicating
 * knowledge: adding 데이터 모델링 to `Data Modeling` adds a row, not a concept.
 */
export type Label = {
  termId: TermId;
  text: string;
  locale: Locale;
  role: LabelRole;
  /** Where this naming came from, precisely enough to re-check by hand. */
  source: string;
};

/**
 * How terms relate. Three kinds, deliberately.
 *
 * An open relation vocabulary becomes a graph nobody can read, which is the
 * shape `CLAUDE.md` refuses to introduce without a proven requirement.
 */
export type RelationKind =
  /** Tool → Capability. Many-to-many: a tool serves several, and vice versa. */
  | "supports"
  /** Capability → Capability. Single parent, so the hierarchy stays readable. */
  | "broader"
  /** Vocabulary → Capability or Tool. */
  | "denotes";

export type Relation = { from: TermId; to: TermId; kind: RelationKind };

/**
 * Monotonic. Bumped by every approved change.
 *
 * Recorded on anything computed against the ontology, because the same posting
 * read against a different vocabulary is a different reading — and a score that
 * moved for a reason nobody recorded is a score nobody can defend.
 */
export type OntologyVersion = number;

export type OntologySnapshot = {
  version: OntologyVersion;
  terms: Term[];
  labels: Label[];
  relations: Relation[];
};

/**
 * How a label is compared to text.
 *
 * Case and separators are ignored so `A/B Test`, `A/B test` and `AB Test` are
 * one label rather than three. This is the only normalisation, and it is shared
 * by resolution and by the duplicate check, so two labels that would collide at
 * lookup collide at load instead.
 */
export function normaliseLabel(text: string): string {
  return text.toLowerCase().replace(/[\s/\-_.'’()]/g, "");
}

/**
 * Problems in a snapshot. Pure, so the rules are testable against a synthetic
 * ontology rather than only against the one that happens to be correct.
 *
 * The rule that matters most: **no two terms may answer to the same label.**
 * A lookup that could return either is a duplicated concept, and it is caught
 * here rather than discovered as two half-populated capabilities later.
 */
export function ontologyProblems(snapshot: OntologySnapshot): string[] {
  const problems: string[] = [];
  const byId = new Map(snapshot.terms.map((t) => [t.id, t]));
  const seenTerm = new Set<string>();

  for (const term of snapshot.terms) {
    if (seenTerm.has(term.id)) problems.push(`용어가 중복 선언되었습니다: ${term.id}`);
    seenTerm.add(term.id);

    if (term.status === "merged" && !term.mergedInto) {
      problems.push(`${term.id}: 병합된 용어인데 대상이 없습니다`);
    }
    if (term.mergedInto && !byId.has(term.mergedInto)) {
      problems.push(`${term.id}: 없는 용어로 병합되었습니다 (${term.mergedInto})`);
    }
  }

  const owner = new Map<string, TermId>();
  const canonical = new Map<string, TermId>();

  for (const label of snapshot.labels) {
    if (!byId.has(label.termId)) {
      problems.push(`라벨이 없는 용어를 가리킵니다: ${label.text} → ${label.termId}`);
      continue;
    }

    const key = normaliseLabel(label.text);
    if (key === "") {
      problems.push(`${label.termId}: 빈 라벨이 있습니다`);
      continue;
    }

    const held = owner.get(key);
    if (held && held !== label.termId) {
      problems.push(`"${label.text}"가 ${held}와 ${label.termId} 두 용어를 가리킵니다`);
    }
    owner.set(key, label.termId);

    if (label.role === "canonical") {
      const slot = `${label.termId}:${label.locale}`;
      if (canonical.has(slot)) {
        problems.push(`${label.termId}: ${label.locale} 대표 라벨이 둘입니다`);
      }
      canonical.set(slot, label.termId);
    }
  }

  for (const term of snapshot.terms) {
    const named = snapshot.labels.some((l) => l.termId === term.id && l.role === "canonical");
    if (!named) problems.push(`${term.id}: 대표 라벨이 없습니다`);
  }

  for (const relation of snapshot.relations) {
    if (!byId.has(relation.from)) problems.push(`관계의 출발 용어가 없습니다: ${relation.from}`);
    if (!byId.has(relation.to)) problems.push(`관계의 대상 용어가 없습니다: ${relation.to}`);
  }

  return problems;
}
