/**
 * Reading and writing the unknown term queue.
 *
 * Candidate sightings live on the representative's own stream, so scoping,
 * ordering and provenance are the ones already established — a candidate cannot
 * be read for the wrong person, and each one carries where and when it was
 * seen.
 *
 * Nothing here decides anything. It records that a word was seen and reports
 * what has accumulated; moving a candidate to deferred or ignored belongs to
 * the approval flow, which does not exist yet.
 */

import { CANDIDATE_TYPE, ignoredTerms, projectCandidates } from "./candidates.ts";
import type { Candidate, DetectedTerm, TermCandidateFact } from "./candidates.ts";
import type { RepresentativeKey } from "../knowledge/representative.ts";
import type { EventStream } from "../../../storage/event-store.ts";

/** Every sighting recorded on this stream, oldest first. */
export function candidateFacts(log: EventStream): TermCandidateFact[] {
  const facts: TermCandidateFact[] = [];

  for (const envelope of log.read()) {
    if (envelope.event.type !== "KnowledgeFactRecorded") continue;
    if (envelope.capability !== "career") continue;
    if (envelope.event.fact.type !== CANDIDATE_TYPE) continue;

    facts.push(envelope.event.fact as TermCandidateFact);
  }

  return facts;
}

/** The queue as it stands. Ignored terms are absent, permanently. */
export function candidateQueue(log: EventStream): Candidate[] {
  return projectCandidates(candidateFacts(log));
}

/** Terms detection must skip, because the representative ruled them out. */
export function ignoredIn(log: EventStream): Set<string> {
  return ignoredTerms(candidateFacts(log));
}

/**
 * Records that a posting named terms Career has no word for.
 *
 * One fact per term per posting. The author is the posting: it is the thing
 * that said the word, and Career is only writing down that it did.
 */
export function noteCandidates(
  input: {
    log: EventStream;
    holdId: string;
    representative: RepresentativeKey;
    sourceId: string;
    sourceLabel: string;
  },
  detected: DetectedTerm[],
): void {
  const now = new Date().toISOString();

  detected.forEach((found, index) => {
    input.log.append(
      {
        type: "KnowledgeFactRecorded",
        holdId: input.holdId,
        fact: {
          id: `candidate-${input.sourceId}-${String(index + 1)}`,
          type: CANDIDATE_TYPE,
          value: {
            term: found.term,
            normalised: found.normalised,
            locale: found.locale,
            sourceId: input.sourceId,
            sourceLabel: input.sourceLabel,
            status: "pending",
          },
          source: `posting:${input.sourceId}`,
          author: { kind: "external", name: "채용공고" },
          acquiredAt: now,
          // The posting did say the word. What it means is not claimed here.
          confidence: 1,
        },
      },
      { kind: "capability", id: "career" },
      "career",
      "career:candidates",
    );
  });
}
