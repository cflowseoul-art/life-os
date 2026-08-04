/**
 * The seeded ontology.
 *
 * Tools only. Every term here is one the representative's verified record
 * already names — the thirteen entries in `skills.md` — promoted from a bare
 * string into something with an identity and more than one possible name.
 *
 * **No capabilities.** ADR-025 makes business capability the primary unit, and
 * assigning capabilities to this record would mean deciding, on the
 * representative's behalf, what their work demonstrates. That is theirs to
 * approve, and nothing here may pre-empt it.
 *
 * Term ids are the skill ids the material was verified under, so a tool term
 * and the evidence behind it are the same thing seen from two sides, with no
 * mapping table to drift.
 *
 * Aliases are only ones the representative wrote down. `INDEX.md` records the
 * canonical tags and their aliases; the two below are the entries in it that
 * name a tool seeded here rather than a capability that does not exist yet.
 * Everything else in that table waits for the capability layer.
 */

import type { Label, OntologySnapshot, Term } from "./types.ts";

/** The version the seeded material is. Bumped by every approved change. */
export const SEEDED_VERSION = 1;

const SKILLS = "career-knowledge:skills.md";
const INDEX = "career-knowledge:INDEX.md";

/** id, canonical name — matching `skills.md` exactly. */
const TOOLS: [string, string][] = [
  ["SKL-001", "SQL"],
  ["SKL-002", "Tableau"],
  ["SKL-003", "Python"],
  ["SKL-004", "Databricks"],
  ["SKL-005", "Firebase"],
  ["SKL-006", "n8n"],
  ["SKL-007", "Git"],
  ["SKL-008", "Logistic Regression"],
  ["SKL-009", "Decision Tree"],
  ["SKL-010", "Welch's t-test"],
  ["SKL-011", "A/B Test"],
  ["SKL-012", "RBAC"],
  ["SKL-013", "Data Modeling"],
];

/**
 * Additional names for terms already above.
 *
 * Each is traceable to the representative's own tag index. Nothing is invented:
 * a plausible translation nobody wrote down would be a guess about what they
 * mean, recorded as if they had said it.
 */
const EXTRA_LABELS: Label[] = [
  // INDEX.md, DATA_MODELING aliases: 데이터 모델링, AI-ready, NLQ.
  { termId: "SKL-013", text: "데이터 모델링", locale: "ko", role: "canonical", source: INDEX },
  // INDEX.md, STATISTICS aliases: 통계 검정, Welch.
  { termId: "SKL-010", text: "Welch", locale: "und", role: "abbreviation", source: INDEX },
];

const terms: Term[] = TOOLS.map(([id]) => ({
  id,
  kind: "tool",
  status: "active",
  mergedInto: null,
  since: SEEDED_VERSION,
  until: null,
}));

const labels: Label[] = [
  ...TOOLS.map(([termId, text]): Label => ({
    termId,
    text,
    // A product name reads the same in both languages, so it belongs to
    // neither: `Tableau` is not an English word the way `Data Modeling` is.
    locale: text === "Data Modeling" ? "en" : "und",
    role: "canonical",
    source: SKILLS,
  })),
  ...EXTRA_LABELS,
];

export const SEEDED_ONTOLOGY: OntologySnapshot = {
  version: SEEDED_VERSION,
  terms,
  labels,
  // Tools support capabilities, and no capability exists yet to support.
  relations: [],
};
