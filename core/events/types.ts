/**
 * The event vocabulary. Everything the system knows is derived from these.
 *
 * Art. 14 (Durability): these types are plain data. No model, agent, or
 * capability is required to read them — an envelope is meaningful on its own.
 * Art. 8 (Transparency): every envelope carries actor, capability, and time.
 */

/** Who caused an event. Art. 8 — an action with no actor is not inspectable. */
export type Actor =
  | { kind: "user" }
  | { kind: "capability"; id: string }
  | { kind: "system" };

/**
 * A fact the system holds.
 *
 * Art. 10 (Memory and Provenance): source, acquisition time, and confidence are
 * required fields, not optional metadata. A fact without them cannot be
 * constructed, so it cannot reach an Ask or an artifact.
 */
export type Observation = {
  id: string;
  /** What is known, in plain language. */
  statement: string;
  /** Where it came from, precisely enough to re-check by hand. */
  source: string;
  acquiredAt: string;
  /** 1 = quoted directly from what the user handed over. */
  confidence: number;
};

/**
 * A question only the user can answer.
 *
 * Art. 4 (The Ask): `facts` exist so the Ask is answerable from what it
 * presents; `options` are explicit and named. Both are required fields.
 */
export type Ask = {
  id: string;
  holdId: string;
  question: string;
  /** Everything needed to decide, carried with the question. */
  facts: string[];
  options: AskOption[];
  raisedAt: string;
};

export type AskOption = {
  id: string;
  label: string;
  /** Observation ids this option is derived from. Art. 8. */
  derivedFrom: string[];
};

/** What was made. Art. 8 — every section names the facts behind it. */
export type Artifact = {
  id: string;
  title: string;
  sections: ArtifactSection[];
};

export type ArtifactSection = {
  heading: string;
  body: string;
  derivedFrom: string[];
};

/** What the user handed over. Career-shaped; capabilities own their own shape. */
export type CareerHandover = {
  company: string;
  role: string;
  jdText: string;
};

export type LifeEvent =
  | { type: "HandedOver"; holdId: string; capability: string; handover: CareerHandover }
  | { type: "ObservationRecorded"; holdId: string; observation: Observation }
  | { type: "AskRaised"; holdId: string; ask: Ask }
  | { type: "AskAnswered"; holdId: string; askId: string; optionId: string }
  | { type: "ProposalRejected"; holdId: string; proposal: string; reasons: string[] }
  | { type: "ArtifactKept"; holdId: string; artifact: Artifact }
  /** Art. 18 (Deletion): corrections append, never destroy. */
  | { type: "HoldWithdrawn"; holdId: string; reason: string };

/**
 * Schema version of the envelope on disk.
 *
 * Art. 14 (Durability): a reader years from now must know which shape it is
 * looking at without asking us. Bumped only when the envelope changes.
 */
export const SCHEMA_VERSION = 1;

export type EventEnvelope = {
  /** Stable for the life of the event. Never regenerated on replay. */
  id: string;
  schemaVersion: number;
  at: string;
  actor: Actor;
  capability: string | null;
  /** Art. 8: what caused this event to be written. */
  source: string;
  event: LifeEvent;
};

/** Art. 3: a handover is identified by its content, so it cannot be doubled. */
export type HandoverKey = string;
