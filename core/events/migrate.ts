/**
 * Reading events written before the current schema.
 *
 * Art. 18 (Deletion): history is never rewritten to fix a shape. Old events stay
 * on disk exactly as they were recorded, and every read path upcasts them to the
 * shape the code expects. A migration that edited the log would destroy the only
 * record of what was actually known at the time.
 *
 * There is one upcast today.
 *
 * Schema 1–2 recorded an `Observation`: an id, a prose `statement`, a source, an
 * acquisition time, and a confidence. It carried no author, because nothing
 * distinguished who *caused* an event from who *asserted* a fact.
 *
 * Those facts become `unstructured` KnowledgeFacts. The statement is preserved
 * verbatim as the value — it is the only payload that ever existed, and parsing
 * it into a typed shape here would be a guess dressed up as a migration. The
 * department that wrote the prose is the only party that knows what it meant, so
 * it reads the prose itself (see each capability's `facts.ts`).
 *
 * The author becomes `unattributed`. It is not inferred from the envelope's
 * actor: the actor is who wrote the event, which is a different question, and
 * substituting one for the other is exactly the conflation `Author` exists to
 * prevent.
 */

import type { EventEnvelope, KnowledgeFact } from "./types.ts";

/** The fact type legacy prose is carried under. Departments narrow it. */
export const UNSTRUCTURED = "unstructured";

/** An unstructured fact holds the original prose statement, unparsed. */
export type UnstructuredFact = KnowledgeFact<typeof UNSTRUCTURED, string>;

/** The shape schema 1–2 persisted. Read-only; nothing constructs one. */
type LegacyObservation = {
  id: string;
  statement: string;
  source: string;
  acquiredAt: string;
  confidence: number;
};

type LegacyObservationRecorded = {
  type: "ObservationRecorded";
  holdId: string;
  observation: LegacyObservation;
};

function isLegacyObservationRecorded(event: unknown): event is LegacyObservationRecorded {
  if (typeof event !== "object" || event === null) return false;

  const candidate = event as { type?: unknown; observation?: unknown };
  if (candidate.type !== "ObservationRecorded") return false;

  const observation = candidate.observation as Partial<LegacyObservation> | undefined;

  return (
    typeof observation === "object"
    && observation !== null
    && typeof observation.id === "string"
    && typeof observation.statement === "string"
  );
}

/**
 * Upcasts one persisted envelope to the current shape.
 *
 * Everything not recognised as legacy is returned untouched, including its
 * recorded `schemaVersion` — the envelope keeps saying which version actually
 * wrote it. Only the event payload is reshaped, and only in memory.
 */
export function upcast(envelope: EventEnvelope): EventEnvelope {
  const event: unknown = envelope.event;

  if (!isLegacyObservationRecorded(event)) return envelope;

  const { id, statement, source, acquiredAt, confidence } = event.observation;

  const fact: UnstructuredFact = {
    id,
    type: UNSTRUCTURED,
    // The statement as recorded. Not parsed, not split, not interpreted.
    value: statement,
    // Provenance that existed is preserved exactly; nothing missing is invented.
    source,
    acquiredAt,
    confidence,
    author: { kind: "unattributed" },
  };

  return {
    ...envelope,
    event: { type: "KnowledgeFactRecorded", holdId: event.holdId, fact },
  };
}

/** Every read path runs this. Cheap, and idempotent on current-shape events. */
export function upcastAll(envelopes: EventEnvelope[]): EventEnvelope[] {
  return envelopes.map(upcast);
}
