/**
 * The event vocabulary. Everything the system knows is derived from these.
 *
 * Art. 14 (Durability): these types are plain data. No model, agent, or
 * capability is required to read them — an envelope is meaningful on its own.
 * Art. 8 (Transparency): every envelope carries actor, capability, and time.
 */

/** Who caused an event. Art. 8 — an action with no actor is not inspectable. */
export type Actor =
  /** `userId` is absent only in events written before identity existed. */
  | { kind: "user"; userId?: string }
  | { kind: "capability"; id: string }
  | { kind: "system" };

/**
 * Who asserts a fact.
 *
 * Distinct from `Actor`, and never substituted for it. `Actor` answers "who
 * caused this event to be written"; `Author` answers "who says this is true".
 * A runner importing something the representative said last month has
 * actor = the runner and author = the representative.
 *
 * `unattributed` exists for facts recorded before authorship was carried. It is
 * never inferred and never back-filled — inventing an author would fabricate
 * exactly the provenance this type exists to guarantee.
 */
export type Author =
  | { kind: "representative"; userId?: string }
  | { kind: "employee"; employeeId: string }
  | { kind: "system" }
  /** A source of record outside the company: a posting, a receipt, a ledger. */
  | { kind: "external"; name: string }
  | { kind: "unattributed" };

/**
 * A fact the system holds.
 *
 * Art. 10 (Memory and Provenance): source, acquisition time, author, and
 * confidence are required fields, not optional metadata. A fact without them
 * cannot be constructed, so it cannot reach an Ask or an artifact.
 *
 * `type` and `value` are **owned by the department that wrote them**. The kernel
 * stores and transports them and never inspects either — there is no global
 * domain vocabulary here, and adding one would put Career (or Home, or Finance)
 * back inside the kernel. Departments declare their own discriminated union over
 * this type and narrow on read.
 *
 * `confidence` means: how strongly does the cited source support this exact
 * stored value? Not importance, not usefulness, not general truth. A direct
 * statement from a source of record is 1; a system or employee inference is
 * always below 1. For an externally reported claim, 1 means "the source did
 * report this", not "this is objectively true".
 */
export type KnowledgeFact<TType extends string = string, TValue = unknown> = {
  id: string;
  /** Department-owned vocabulary. Opaque to the kernel. */
  type: TType;
  /** Department-owned shape. Opaque to the kernel. */
  value: TValue;
  /** Where the evidence came from, precisely enough to re-check by hand. */
  source: string;
  /** Who asserts it. Never the envelope's actor. */
  author: Author;
  acquiredAt: string;
  confidence: number;
  /** Fact ids this was derived or inferred from. Absent for direct facts. */
  derivedFrom?: string[];
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
  /** KnowledgeFact ids this option is derived from. Art. 8. */
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
  | { type: "KnowledgeFactRecorded"; holdId: string; fact: KnowledgeFact }
  | { type: "AskRaised"; holdId: string; ask: Ask }
  | { type: "AskAnswered"; holdId: string; askId: string; optionId: string }
  /** The representative wrote their own instruction instead of choosing. */
  | { type: "RevisionRequested"; holdId: string; askId: string; feedback: string }
  | { type: "ProposalRejected"; holdId: string; proposal: string; reasons: string[] }
  | { type: "ArtifactKept"; holdId: string; artifact: Artifact }
  /** Art. 18 (Deletion): corrections append, never destroy. */
  | { type: "HoldWithdrawn"; holdId: string; reason: string };

/**
 * Schema version of the envelope on disk.
 *
 * Art. 14 (Durability): a reader years from now must know which shape it is
 * looking at without asking us. Bumped only when the envelope changes.
 *
 * 3 — Observation became KnowledgeFact: typed `type`/`value` replacing a prose
 *     `statement`, and a required `author` separate from the envelope's actor.
 *     Version 1 and 2 events are upcast on read; see `migrate.ts`.
 */
export const SCHEMA_VERSION = 3;

export type EventEnvelope = {
  /** Which household this belongs to. Absent in pre-identity events. */
  householdId?: string;
  /** Whose stream it belongs to, for personal capabilities. */
  scope?: "personal" | "household";
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
