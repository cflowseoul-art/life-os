/**
 * Reviewing what Career does not have a word for.
 *
 * The queue accumulates in silence. This is what happens when the
 * representative chooses to look at it — all of it, at once, so a decision
 * about one term is made next to the others rather than one interruption at a
 * time (Art. 1).
 *
 * Nothing here decides anything on the representative's behalf. It presents
 * what was seen, offers the shapes a term can take, and writes only what was
 * approved. There is no search, no suggestion drawn from outside the record,
 * and no path from free text to the vocabulary that does not pass through an
 * explicit confirmation.
 */

import { randomUUID } from "node:crypto";

import { normaliseLabel } from "./types.ts";
import { CANDIDATE_TYPE } from "./candidates.ts";
import { recordChange } from "./changes.ts";
import { candidateQueue } from "./queue.ts";
import type { Candidate } from "./candidates.ts";
import type { CareerOntology } from "./index.ts";
import type { Label, Term, TermId, TermKind } from "./types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

/** What a candidate may become. Seven, and no eighth. */
export type ReviewOptionKind =
  | "alias"
  | "capability"
  | "tool"
  | "vocabulary"
  | "not_a_term"
  | "defer"
  | "direct";

export const REVIEW_OPTIONS: { kind: ReviewOptionKind; label: string }[] = [
  { kind: "alias", label: "이미 있는 용어의 다른 이름" },
  { kind: "capability", label: "새 업무 역량" },
  { kind: "tool", label: "새 도구" },
  { kind: "vocabulary", label: "새 업무 용어" },
  { kind: "not_a_term", label: "용어가 아님" },
  { kind: "defer", label: "나중에 보기" },
  { kind: "direct", label: "기타 · 직접 입력" },
];

/** One candidate as the review presents it. */
export type ReviewItem = {
  candidate: Candidate;
  /**
   * Terms this might already be a name for.
   *
   * Local only — label comparison against the vocabulary already held. No
   * search, and no claim that any of them is right. It exists so the same
   * concept is not entered twice under a Korean and an English name, which is
   * the one mistake this vocabulary cannot recover from cheaply.
   */
  nearMatches: { termId: TermId; name: string }[];
};

export type Review = {
  items: ReviewItem[];
  /** The vocabulary the review was opened against. */
  version: number;
};

/** Terms whose name contains, or is contained by, this one. */
function nearMatches(term: string, ontology: CareerOntology): ReviewItem["nearMatches"] {
  const key = normaliseLabel(term);
  if (key.length < 3) return [];

  return ontology
    .terms()
    .filter((t) => t.status === "active")
    .flatMap((t) => {
      const hit = ontology
        .labelsOf(t.id)
        .some((l) => {
          const other = normaliseLabel(l.text);
          return other.length >= 3 && (other.includes(key) || key.includes(other));
        });

      return hit ? [{ termId: t.id, name: ontology.nameOf(t.id) }] : [];
    });
}

/**
 * Everything waiting, in one review.
 *
 * Deferred candidates are included: deferring means "not now", not "never", and
 * a queue that hid them would make deferral indistinguishable from ignoring.
 */
export function openReview(log: EventStream, ontology: CareerOntology): Review {
  const items = candidateQueue(log)
    .filter((c) => c.status === "pending" || c.status === "deferred")
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.normalised.localeCompare(b.normalised))
    .map((candidate) => ({ candidate, nearMatches: nearMatches(candidate.term, ontology) }));

  return { items, version: ontology.version() };
}

/* ── Direct input ───────────────────────────────────────────────────────── */

/**
 * What the representative wrote, read into a shape they can check.
 *
 * The text is kept exactly as written and never becomes the record on its own.
 * Reading it is deterministic and literal: a keyword names the kind, a marked
 * line names the aliases, and anything not recognised is reported as not
 * recognised rather than guessed at.
 */
export type DirectProposal = {
  term: string;
  /** Verbatim. Never edited, never summarised, never normalised. */
  text: string;
  kind: TermKind | null;
  aliases: string[];
  /** How the text was read, so the representative can see what was inferred. */
  reading: string;
};

const KIND_WORDS: { kind: TermKind; words: string[] }[] = [
  { kind: "tool", words: ["도구", "툴", "tool"] },
  { kind: "capability", words: ["역량", "능력", "capability"] },
  { kind: "vocabulary", words: ["용어", "vocabulary", "표현"] },
];

const ALIAS_MARKERS = ["별칭:", "별칭 :", "다른 이름:", "alias:", "aliases:"];

export function proposeFromText(term: string, text: string): DirectProposal {
  const said = text;

  let kind: TermKind | null = null;
  for (const entry of KIND_WORDS) {
    if (entry.words.some((w) => said.toLowerCase().includes(w))) {
      kind = entry.kind;
      break;
    }
  }

  const aliases: string[] = [];
  for (const marker of ALIAS_MARKERS) {
    const at = said.toLowerCase().indexOf(marker);
    if (at === -1) continue;

    const line = said.slice(at + marker.length).split("\n")[0];
    for (const raw of line.split(/[,·/]/)) {
      const alias = raw.trim();
      if (alias.length >= 2 && normaliseLabel(alias) !== normaliseLabel(term)) aliases.push(alias);
    }
    break;
  }

  const reading = kind === null
    ? "어떤 종류인지 찾지 못했습니다. 역량·도구·용어 중 하나를 적어 주십시오."
    : `${kind === "tool" ? "도구" : kind === "capability" ? "역량" : "용어"}로 읽었습니다.`
      + (aliases.length > 0 ? ` 다른 이름 ${String(aliases.length)}개를 함께 읽었습니다.` : "");

  return { term, text: said, kind, aliases, reading };
}

/* ── Decisions ──────────────────────────────────────────────────────────── */

export type ReviewDecision =
  | { kind: "alias"; term: string; targetTermId: TermId }
  | { kind: "capability" | "tool" | "vocabulary"; term: string; aliases?: string[] }
  | { kind: "not_a_term"; term: string }
  | { kind: "defer"; term: string }
  /** Opens the textarea. Writes nothing; returns a proposal to confirm. */
  | { kind: "direct"; term: string; text: string }
  /** Confirms a proposal the representative has now seen. Only this writes. */
  | { kind: "approve_direct"; term: string; text: string };

export type ReviewOutcome = {
  /** Terms whose status moved. */
  settled: string[];
  deferred: string[];
  ignored: string[];
  /** Proposals awaiting confirmation. Nothing was written for these. */
  awaiting: DirectProposal[];
  /** The vocabulary version after the review, unchanged when nothing was added. */
  version: number;
  refusals: string[];
};

function statusFact(
  log: EventStream,
  holdId: string,
  candidate: Candidate,
  status: "deferred" | "ignored",
): void {
  log.append(
    {
      type: "KnowledgeFactRecorded",
      holdId,
      fact: {
        id: `candidate-${status}-${candidate.normalised}-${randomUUID().slice(0, 8)}`,
        type: CANDIDATE_TYPE,
        value: {
          term: candidate.term,
          normalised: candidate.normalised,
          locale: candidate.locale,
          sourceId: candidate.sources[0]?.sourceId ?? "review",
          sourceLabel: candidate.sources[0]?.sourceLabel ?? "검토",
          status,
        },
        source: "대표님 결정",
        author: { kind: "representative" },
        acquiredAt: new Date().toISOString(),
        confidence: 1,
      },
    },
    { kind: "capability", id: "career" },
    "career",
    "career:candidates",
  );
}

/**
 * Applies a review.
 *
 * Every approval in one batch becomes one version. A term that would break the
 * vocabulary takes the whole batch down rather than being written alongside the
 * others — a half-applied review leaves the representative unable to tell what
 * they actually decided.
 */
export function applyReview(
  input: { log: EventStream; holdId: string; ontology: CareerOntology },
  decisions: ReviewDecision[],
): ReviewOutcome {
  const { log, holdId, ontology } = input;
  const queue = new Map(candidateQueue(log).map((c) => [c.normalised, c]));

  const outcome: ReviewOutcome = {
    settled: [], deferred: [], ignored: [], awaiting: [], version: ontology.version(), refusals: [],
  };

  const terms: Term[] = [];
  const labels: Label[] = [];
  const settled: string[] = [];
  const nextVersion = ontology.version() + 1;

  for (const decision of decisions) {
    const key = normaliseLabel(decision.term);
    const candidate = queue.get(key);

    if (!candidate) {
      outcome.refusals.push(`검토 목록에 없는 표현입니다: ${decision.term}`);
      continue;
    }

    switch (decision.kind) {
      case "defer":
        statusFact(log, holdId, candidate, "deferred");
        outcome.deferred.push(candidate.term);
        break;

      case "not_a_term":
        statusFact(log, holdId, candidate, "ignored");
        outcome.ignored.push(candidate.term);
        break;

      case "alias": {
        const target = ontology.byId(decision.targetTermId);
        if (!target) {
          outcome.refusals.push(`없는 용어에 붙일 수 없습니다: ${decision.targetTermId}`);
          break;
        }

        labels.push({
          termId: target.id,
          text: candidate.term,
          locale: candidate.locale,
          role: "alias",
          source: "대표님 승인",
        });
        settled.push(candidate.normalised);
        break;
      }

      case "capability":
      case "tool":
      case "vocabulary": {
        const id = `TRM-${randomUUID().slice(0, 8)}`;

        terms.push({
          id, kind: decision.kind, status: "active", mergedInto: null,
          since: nextVersion, until: null,
        });
        labels.push({
          termId: id, text: candidate.term, locale: candidate.locale,
          role: "canonical", source: "대표님 승인",
        });

        for (const alias of decision.aliases ?? []) {
          labels.push({
            termId: id, text: alias, locale: "und", role: "alias", source: "대표님 승인",
          });
        }

        settled.push(candidate.normalised);
        break;
      }

      case "direct":
        // The textarea closed; nothing is written. The representative sees how
        // their words were read and confirms before the vocabulary changes.
        outcome.awaiting.push(proposeFromText(candidate.term, decision.text));
        break;

      case "approve_direct": {
        // Re-read rather than stored, so what is written is exactly what was
        // shown: the reading is deterministic, so it cannot have drifted.
        const proposal = proposeFromText(candidate.term, decision.text);

        if (!proposal.kind) {
          outcome.refusals.push(`${candidate.term}: ${proposal.reading}`);
          break;
        }

        const id = `TRM-${randomUUID().slice(0, 8)}`;

        terms.push({
          id, kind: proposal.kind, status: "active", mergedInto: null,
          since: nextVersion, until: null,
        });
        labels.push({
          termId: id, text: candidate.term, locale: candidate.locale,
          role: "canonical", source: "대표님 직접 입력",
        });

        for (const alias of proposal.aliases) {
          labels.push({
            termId: id, text: alias, locale: "und", role: "alias", source: "대표님 직접 입력",
          });
        }

        settled.push(candidate.normalised);
        break;
      }
    }
  }

  if (terms.length === 0 && labels.length === 0) return outcome;

  const written = recordChange(
    {
      log,
      holdId,
      before: {
        version: ontology.version(),
        terms: ontology.terms(),
        labels: ontology.terms().flatMap((t) => ontology.labelsOf(t.id)),
        relations: [],
      },
    },
    { terms, labels, relations: [], settled },
  );

  if (!written.ok) {
    outcome.refusals.push(...written.reasons);
    return outcome;
  }

  outcome.version = written.version;
  outcome.settled = settled;
  return outcome;
}
