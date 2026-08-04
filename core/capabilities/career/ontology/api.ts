/**
 * The review, as an authenticated request answers it.
 *
 * Two things happen here and nothing else: a review is read, and a batch of
 * decisions is applied. Both compose what already exists — `openReviewWithResearch`
 * and `applyReview` — so the rules about what may be searched, what may be
 * written, and what needs a second confirmation live in one place and are not
 * restated at the edge.
 *
 * **Identity comes from the session and only from the session.** Nothing below
 * reads a household or a user out of a request body, and a body that carries
 * one is refused rather than ignored: a request that names whose vocabulary it
 * wants is asking to act as somebody else, and quietly dropping the field would
 * make that attempt look like it succeeded.
 */

import { applyReview, openReviewWithResearch } from "./review.ts";
import { careerOntologyFor } from "./provider.ts";
import { representativeOf } from "../knowledge/representative.ts";
import type { Review, ReviewDecision, ReviewOutcome } from "./review.ts";
import type { TermSearch } from "./research.ts";
import type { ActorContext } from "../../../identity/types.ts";
import type { EventStream } from "../../../storage/event-store.ts";

/**
 * The hold term work is recorded against.
 *
 * Curating a vocabulary is not a piece of work the representative handed over,
 * so there is no handover and no work order. The id is stable so the facts stay
 * together, and the desk's hold projection ignores an id it never saw handed
 * over — which is the correct treatment for something that is not work.
 */
export const TERMS_HOLD = "career-terms";

/** Fields that would name somebody. A request may not choose whose queue it reads. */
const IDENTITY_FIELDS = ["representative", "householdId", "userId", "actor", "owner"];

export type DecisionParse =
  | { ok: true; decisions: ReviewDecision[] }
  | { ok: false; reasons: string[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Reads a batch of decisions, refusing anything it cannot type.
 *
 * Every field is checked rather than trusted. An unrecognised kind is refused
 * and not skipped: a batch that silently dropped one decision would report
 * success for a review the representative believes they completed.
 */
export function readDecisions(body: unknown): DecisionParse {
  const envelope = asRecord(body);
  if (!envelope) return { ok: false, reasons: ["요청을 읽을 수 없습니다."] };

  for (const field of IDENTITY_FIELDS) {
    if (field in envelope) {
      return { ok: false, reasons: [`대표를 지정할 수 없습니다: ${field}`] };
    }
  }

  const raw = envelope.decisions;
  if (!Array.isArray(raw)) return { ok: false, reasons: ["결정 목록이 없습니다."] };
  if (raw.length === 0) return { ok: false, reasons: ["결정이 비어 있습니다."] };

  const decisions: ReviewDecision[] = [];
  const reasons: string[] = [];

  for (const [index, entry] of raw.entries()) {
    const at = `${String(index + 1)}번째 결정`;
    const decision = asRecord(entry);

    if (!decision) {
      reasons.push(`${at}: 읽을 수 없습니다.`);
      continue;
    }

    for (const field of IDENTITY_FIELDS) {
      if (field in decision) reasons.push(`${at}: 대표를 지정할 수 없습니다.`);
    }

    const term = text(decision.term).trim();
    if (term === "") {
      reasons.push(`${at}: 어떤 표현인지 없습니다.`);
      continue;
    }

    switch (decision.kind) {
      case "defer":
      case "not_a_term":
        decisions.push({ kind: decision.kind, term });
        break;

      case "alias": {
        const targetTermId = text(decision.targetTermId).trim();
        if (targetTermId === "") {
          reasons.push(`${at}: 어느 용어의 다른 이름인지 없습니다.`);
          break;
        }
        decisions.push({ kind: "alias", term, targetTermId });
        break;
      }

      case "capability":
      case "tool":
      case "vocabulary": {
        const aliases = Array.isArray(decision.aliases)
          ? decision.aliases.map(text).map((a) => a.trim()).filter((a) => a !== "")
          : undefined;

        decisions.push({ kind: decision.kind, term, ...(aliases ? { aliases } : {}) });
        break;
      }

      case "direct":
      case "approve_direct": {
        // Kept exactly as sent — not trimmed, not normalised. What the
        // representative wrote is what a proposal is read from.
        const written = decision.text;
        if (typeof written !== "string" || written.trim() === "") {
          reasons.push(`${at}: 입력하신 내용이 없습니다.`);
          break;
        }
        decisions.push({ kind: decision.kind, term, text: written });
        break;
      }

      default:
        reasons.push(`${at}: 알 수 없는 결정입니다.`);
    }
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, decisions };
}

/**
 * The review for whoever is signed in.
 *
 * Scoped by the session's representative on both sides: the vocabulary is
 * theirs, and the queue is read from their own stream.
 */
// `async` so a refusal rejects rather than throwing at the call: the route
// hands this to `.catch`, and a synchronous throw would escape it.
export async function careerTermReview(
  actor: ActorContext,
  log: EventStream,
  search?: TermSearch,
): Promise<Review> {
  // Refused when the request carries no usable identity, before any read.
  representativeOf(actor);

  return openReviewWithResearch({
    log,
    holdId: TERMS_HOLD,
    ontology: careerOntologyFor(actor, log),
    search,
  });
}

/** Applies a batch for whoever is signed in. */
export function careerTermDecide(
  actor: ActorContext,
  log: EventStream,
  decisions: ReviewDecision[],
): ReviewOutcome {
  representativeOf(actor);

  return applyReview(
    { log, holdId: TERMS_HOLD, ontology: careerOntologyFor(actor, log) },
    decisions,
  );
}
