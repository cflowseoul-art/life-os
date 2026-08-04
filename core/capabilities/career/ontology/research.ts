/**
 * Finding out what a word might mean.
 *
 * §2: Research finds out what is true when a domain department needs a fact it
 * does not own. It returns findings with source and acquisition time, or an
 * explicit "not found" — it never lowers the standard, and it never guesses. It
 * also never reports to the representative: what it returns here is a
 * suggestion for the review to offer, not an answer.
 *
 * **Nothing here writes to the vocabulary.** A suggestion is a proposal with a
 * confidence and the evidence behind it. Only an approval makes a claim about
 * what a word means, and that is somewhere else entirely.
 *
 * The search itself is a seam, the way OCR is: a function the capability is
 * handed, so no domain code imports a search SDK. There is no adapter today, so
 * the default refuses and says so rather than pretending to have looked.
 */

import { normaliseLabel } from "./types.ts";
import { candidateQueue } from "./queue.ts";
import type { Candidate } from "./candidates.ts";
import type { CareerOntology } from "./index.ts";
import type { TermId } from "./types.ts";
import type { KnowledgeFact } from "../../../events/types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

export const RESEARCH_TYPE = "term_research";

/** One thing that was found, with where and when. Art. 10. */
export type SearchFinding = {
  title: string;
  snippet: string;
  source: string;
  retrievedAt: string;
};

/** Nothing was found, which is an answer rather than a failure. */
export class SearchFoundNothing extends Error {
  constructor(query: string) {
    super(`찾지 못했습니다: ${query}`);
    this.name = "SearchFoundNothing";
  }
}

/** No adapter is configured. Distinct from having looked and found nothing. */
export class SearchUnavailable extends Error {
  constructor() {
    super("지금은 찾아볼 수 없습니다.");
    this.name = "SearchUnavailable";
  }
}

/**
 * The search seam.
 *
 * A real adapter implements this signature and nothing else changes — the
 * capability never learns which one it is talking to.
 */
export type TermSearch = (query: string) => Promise<SearchFinding[]>;

/** The default. Refuses rather than returning an empty result that reads as "nothing exists". */
export const unavailableSearch: TermSearch = () => Promise.reject(new SearchUnavailable());

export type SuggestionKind =
  | "existing_term"
  | "alias"
  | "tool"
  | "capability"
  | "vocabulary"
  | "unknown";

export type Suggestion = {
  kind: SuggestionKind;
  /** Set for `existing_term` and `alias`. */
  targetTermId?: TermId;
  label: string;
  /** 0–1. How strongly the evidence supports this reading, and nothing more. */
  confidence: number;
  rationale: string;
  /** The findings behind it. Empty when the reading came from the vocabulary. */
  evidence: SearchFinding[];
};

/** What a search produced for one candidate, cached on the representative's stream. */
export type TermResearchFact = KnowledgeFact<"term_research", {
  term: string;
  normalised: string;
  searchedAt: string;
  suggestions: Suggestion[];
  evidence: SearchFinding[];
}>;

export type TermResearch = TermResearchFact["value"];

/**
 * Below this, the reading is reported as `unknown`.
 *
 * Declared, not measured. There is no scale for how strongly a handful of
 * search results support a reading, and a precise-looking threshold would be
 * the kind of unsourced figure Art. 9 rejects. It is stated here so it can be
 * argued with rather than discovered in a ranking function.
 */
export const MIN_CONFIDENCE = 0.5;

/** A near-identical label is strong evidence on its own — no search needed. */
const ALIAS_CONFIDENCE = 0.8;

/**
 * Words that suggest what kind of thing a term is.
 *
 * Literal and inspectable, in both languages. A model may later propose a kind
 * and this ranking will still be the thing that decides what is offered.
 */
const KIND_SIGNALS: { kind: Exclude<SuggestionKind, "existing_term" | "alias" | "unknown">; words: string[] }[] = [
  {
    kind: "tool",
    words: ["tool", "platform", "software", "service", "library", "framework", "database",
      "도구", "툴", "플랫폼", "소프트웨어", "서비스", "라이브러리", "데이터베이스"],
  },
  {
    kind: "capability",
    words: ["analysis", "analytics", "management", "design", "engineering", "practice",
      "분석", "설계", "관리", "역량", "기획", "운영"],
  },
  {
    kind: "vocabulary",
    words: ["term", "concept", "refers to", "means", "methodology",
      "용어", "개념", "의미", "방법론"],
  },
];

function mentions(finding: SearchFinding, word: string): boolean {
  const haystack = `${finding.title} ${finding.snippet}`.toLowerCase();
  return haystack.includes(word.toLowerCase());
}

/**
 * Ranks what the findings support.
 *
 * Deterministic: the same findings always produce the same suggestions, in the
 * same order. Confidence is the share of findings that carry a signal for that
 * kind — arithmetic over what was returned, so the figure can be checked.
 */
export function rankSuggestions(
  term: string,
  findings: SearchFinding[],
  ontology: CareerOntology,
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // The vocabulary answers first. A word it already holds needs no search.
  const held = ontology.resolve(term);
  if (held) {
    suggestions.push({
      kind: "existing_term",
      targetTermId: held.id,
      label: ontology.nameOf(held.id),
      confidence: 1,
      rationale: "이미 가지고 있는 용어입니다.",
      evidence: [],
    });
  }

  const key = normaliseLabel(term);

  for (const candidateTerm of ontology.terms()) {
    if (candidateTerm.status !== "active" || candidateTerm.id === held?.id) continue;

    const close = ontology
      .labelsOf(candidateTerm.id)
      .some((l) => {
        const other = normaliseLabel(l.text);
        return other.length >= 3 && key.length >= 3 && (other.includes(key) || key.includes(other));
      });

    if (!close) continue;

    suggestions.push({
      kind: "alias",
      targetTermId: candidateTerm.id,
      label: ontology.nameOf(candidateTerm.id),
      confidence: ALIAS_CONFIDENCE,
      rationale: `이미 있는 "${ontology.nameOf(candidateTerm.id)}"의 다른 이름일 수 있습니다.`,
      evidence: [],
    });
  }

  if (findings.length > 0) {
    for (const signal of KIND_SIGNALS) {
      const supporting = findings.filter((f) => signal.words.some((w) => mentions(f, w)));
      if (supporting.length === 0) continue;

      suggestions.push({
        kind: signal.kind,
        label: term,
        confidence: Math.round((supporting.length / findings.length) * 100) / 100,
        rationale: `찾은 자료 ${String(findings.length)}건 중 ${String(supporting.length)}건이 이 종류를 가리킵니다.`,
        evidence: supporting,
      });
    }
  }

  const ranked = suggestions
    .filter((s) => s.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence || a.kind.localeCompare(b.kind));

  if (ranked.length > 0) return ranked;

  // Everything was too weak to state. Saying so is the finding.
  return [{
    kind: "unknown",
    label: term,
    confidence: 0,
    rationale: findings.length === 0
      ? "참고할 자료를 찾지 못했습니다."
      : `찾은 자료 ${String(findings.length)}건으로는 무엇인지 판단하기 어렵습니다.`,
    evidence: findings,
  }];
}

/* ── Cache ──────────────────────────────────────────────────────────────── */

/** Every search recorded on this stream, oldest first. */
export function researchFacts(log: EventStream): TermResearchFact[] {
  const facts: TermResearchFact[] = [];

  for (const envelope of log.read()) {
    if (envelope.event.type !== "KnowledgeFactRecorded") continue;
    if (envelope.capability !== "career") continue;
    if (envelope.event.fact.type !== RESEARCH_TYPE) continue;

    facts.push(envelope.event.fact as TermResearchFact);
  }

  return facts;
}

/** What was found for a term last time, or null when it has never been searched. */
export function cachedResearch(log: EventStream, term: string): TermResearch | null {
  const key = normaliseLabel(term);
  const found = researchFacts(log).filter((f) => f.value.normalised === key);

  return found.length > 0 ? found[found.length - 1].value : null;
}

export type ResearchOutcome =
  | { ok: true; research: TermResearch; cached: boolean }
  | { ok: false; reason: string };

/**
 * Looks a candidate up, once.
 *
 * A cached result is returned without searching again — the second reader of a
 * review should not cost a second lookup, and a term whose meaning was settled
 * last week has not changed because somebody opened the list. `refresh` is the
 * only way past it, and it has to be asked for.
 *
 * Only pending candidates are searched. A deferred one was already looked at
 * and put aside; an ignored one is not a term.
 */
export async function researchCandidate(
  input: { log: EventStream; holdId: string; ontology: CareerOntology; search?: TermSearch },
  term: string,
  options: { refresh?: boolean } = {},
): Promise<ResearchOutcome> {
  const { log, holdId, ontology, search = unavailableSearch } = input;

  const candidate = candidateQueue(log).find(
    (c: Candidate) => c.normalised === normaliseLabel(term),
  );

  if (!candidate) return { ok: false, reason: `검토 목록에 없는 표현입니다: ${term}` };
  if (candidate.status !== "pending") {
    return { ok: false, reason: `${candidate.term}은(는) 아직 볼 차례가 아닙니다.` };
  }

  const cached = cachedResearch(log, term);
  if (cached && options.refresh !== true) {
    return { ok: true, research: cached, cached: true };
  }

  let findings: SearchFinding[];

  try {
    findings = await search(candidate.term);
  } catch (error) {
    // Nothing is cached when the search never happened. Caching "unavailable"
    // would make a missing adapter look like a settled answer for ever.
    return {
      ok: false,
      reason: error instanceof SearchUnavailable
        ? "지금은 찾아볼 수 없습니다."
        : error instanceof SearchFoundNothing
          ? "참고할 자료를 찾지 못했습니다."
          : "찾아보지 못했습니다.",
    };
  }

  const research: TermResearch = {
    term: candidate.term,
    normalised: candidate.normalised,
    searchedAt: new Date().toISOString(),
    suggestions: rankSuggestions(candidate.term, findings, ontology),
    evidence: findings,
  };

  log.append(
    {
      type: "KnowledgeFactRecorded",
      holdId,
      fact: {
        id: `research-${candidate.normalised}-${String(researchFacts(log).length + 1)}`,
        type: RESEARCH_TYPE,
        value: research,
        source: "research",
        // Research looked; it does not assert what the word means.
        author: { kind: "system" },
        acquiredAt: research.searchedAt,
        confidence: research.suggestions[0]?.confidence ?? 0,
      },
    },
    { kind: "capability", id: "career" },
    "career",
    "career:research",
  );

  return { ok: true, research, cached: false };
}
