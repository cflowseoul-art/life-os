/**
 * The custody engine. Hold, ask, keep.
 *
 * This is the only module that writes. Capabilities propose; the engine decides
 * whether a proposal becomes an event (Art. 7).
 *
 * Art. 2 (Silence): every public method returns what happened, and the caller
 * decides whether that justifies output. The engine itself prints nothing.
 */

import { createHash, randomUUID } from "node:crypto";

import { EventLog } from "../events/log.ts";
import type { Artifact, Ask, EventEnvelope, KnowledgeFact } from "../events/types.ts";
import * as career from "../capabilities/career/index.ts";

/**
 * The replaceable execution boundary.
 *
 * Today work advances inline, inside the calling process. That is a property of
 * the proof, not of the model: `Runner` is the single seam a queue, a daemon, or
 * a job scheduler replaces. Nothing outside this file knows which runner is in
 * use, so swapping it changes no other module.
 */
export interface Runner {
  run(task: () => void): void;
}

/** Synchronous. Correct, and explicitly temporary. */
export class InlineRunner implements Runner {
  run(task: () => void): void {
    task();
  }
}

/**
 * Content address of a handover.
 *
 * Art. 3 (Custody): re-running the same handover must not create a second hold.
 * The key is derived from what was handed over, so identity does not depend on
 * anyone remembering an id.
 */
export function handoverKey(input: {
  company: string;
  role: string;
  jdText: string;
}): string {
  return createHash("sha256")
    .update(`${input.company.trim()}\u0000${input.role.trim()}\u0000${input.jdText.trim()}`)
    .digest("hex");
}

/** Art. 4: three states, and `asking` is the only one that may reach the user. */
export type HoldState = "held" | "asking" | "kept" | "withdrawn";

export type Hold = {
  id: string;
  key: string;
  capability: string;
  state: HoldState;
  company: string;
  role: string;
  facts: KnowledgeFact[];
  outstandingAsk: Ask | null;
  answeredAsks: { askId: string; optionId: string }[];
  artifact: Artifact | null;
  withdrawnReason: string | null;
};

/**
 * State is always replayed from the log, never cached.
 *
 * Art. 3 (Custody): there is no in-memory source of truth to lose. Art. 11: the
 * Ledger is this same projection, so it cannot drift from what the engine sees.
 */
export function project(events: EventEnvelope[]): Map<string, Hold> {
  const holds = new Map<string, Hold>();

  for (const { event } of events) {
    if (event.type === "HandedOver") {
      holds.set(event.holdId, {
        id: event.holdId,
        key: handoverKey(event.handover),
        capability: event.capability,
        state: "held",
        company: event.handover.company,
        role: event.handover.role,
        facts: [],
        outstandingAsk: null,
        answeredAsks: [],
        artifact: null,
        withdrawnReason: null,
      });
      continue;
    }

    const hold = holds.get(event.holdId);
    if (!hold) continue;

    switch (event.type) {
      case "KnowledgeFactRecorded":
        hold.facts.push(event.fact);
        break;
      case "AskRaised":
        hold.outstandingAsk = event.ask;
        hold.state = "asking";
        break;
      case "AskAnswered":
        hold.answeredAsks.push({ askId: event.askId, optionId: event.optionId });
        hold.outstandingAsk = null;
        hold.state = "held";
        break;
      case "ArtifactKept":
        hold.artifact = event.artifact;
        hold.state = "kept";
        break;
      case "HoldWithdrawn":
        hold.state = "withdrawn";
        hold.withdrawnReason = event.reason;
        break;
      case "ProposalRejected":
        // Recorded for inspection (Art. 8). Does not change state.
        break;
    }
  }

  return holds;
}

/**
 * Art. 9 (Trust) enforced in code, not in review.
 *
 * Every integer appearing in user-facing copy must be a number the capability
 * can point at in the record. A proposal that states an unbacked figure is
 * rejected and the rejection is recorded.
 */
export function unbackedNumbers(artifact: Artifact, allowed: Set<number>): number[] {
  const text = [
    artifact.title,
    ...artifact.sections.flatMap((s) => [s.heading, s.body]),
  ].join(" ");

  const found = text.match(/\d+/g) ?? [];

  return found
    .map(Number)
    .filter((value) => !allowed.has(value));
}

export class CustodyEngine {
  constructor(
    private readonly log: EventLog = new EventLog(),
    private readonly runner: Runner = new InlineRunner(),
  ) {}

  private holds(): Map<string, Hold> {
    return project(this.log.read());
  }

  /** Art. 4: at most one Ask may be outstanding across the whole system. */
  outstandingAsk(): Ask | null {
    for (const hold of this.holds().values()) {
      if (hold.outstandingAsk) return hold.outstandingAsk;
    }
    return null;
  }

  ledger(): Hold[] {
    return [...this.holds().values()];
  }

  /**
   * Hand over. Refuses invalid input before recording anything, then records
   * durably before returning (Art. 3), then works until it needs judgment.
   */
  handOver(input: { company: string; role: string; jdText: string }):
    | { ok: false; reasons: string[] }
    | { ok: true; holdId: string; duplicate: boolean } {
    const validated = career.validateHandover(input);

    if (!validated.ok || !validated.value) {
      return { ok: false, reasons: validated.reasons };
    }

    // Art. 3: the same handover, handed over twice, is one hold.
    const key = handoverKey(validated.value);
    const existing = [...this.holds().values()].find(
      (hold) => hold.key === key && hold.state !== "withdrawn",
    );

    if (existing) {
      this.runner.run(() => { this.advance(existing.id); });
      return { ok: true, holdId: existing.id, duplicate: true };
    }

    const holdId = randomUUID();

    this.log.append(
      {
        type: "HandedOver",
        holdId,
        capability: career.CAPABILITY_ID,
        handover: validated.value,
      },
      { kind: "user" },
    );

    this.runner.run(() => { this.advance(holdId); });

    return { ok: true, holdId, duplicate: false };
  }

  /**
   * Does everything that does not require the user, then stops.
   *
   * Art. 1 (Attention): stopping is the point. The engine works to the fork and
   * no further, and raises exactly one Ask when it gets there.
   */
  advance(holdId: string): void {
    const hold = this.holds().get(holdId);

    if (!hold || hold.state === "kept" || hold.state === "withdrawn") {
      return;
    }

    const actor = { kind: "capability" as const, id: career.CAPABILITY_ID };
    const now = new Date().toISOString();

    // Re-read the original handover from the log — the engine holds no cache.
    const handedOver = this.log
      .read()
      .find((e) => e.event.type === "HandedOver" && e.event.holdId === holdId);

    if (!handedOver || handedOver.event.type !== "HandedOver") return;

    const handover = handedOver.event.handover;

    // 1. Observe. Only once — replay makes this idempotent by inspection.
    if (hold.facts.length === 0) {
      for (const fact of career.observe(handover, now)) {
        this.log.append(
          { type: "KnowledgeFactRecorded", holdId, fact },
          actor,
          career.CAPABILITY_ID,
        );
      }
    }

    const current = this.holds().get(holdId);
    if (!current) return;

    // 2. Ask, if judgment is genuinely required and none is outstanding.
    if (!current.outstandingAsk && current.answeredAsks.length === 0) {
      const needed = career.judgmentNeeded(holdId, handover, current.facts, now);

      if (needed) {
        // Art. 4: system-wide, not per-hold. A second Ask waits.
        if (this.outstandingAsk()) return;

        this.log.append(
          { type: "AskRaised", holdId, ask: { ...needed, id: randomUUID() } },
          actor,
          career.CAPABILITY_ID,
        );
        return;
      }
    }

    if (current.outstandingAsk) return;

    // 3. Propose the artifact. The engine validates before it becomes real.
    const answer = current.answeredAsks[0];
    const leadId = answer?.optionId ?? current.facts[0]?.id;

    if (!leadId) return;

    const proposal = career.proposeArtifact(handover, current.facts, leadId);
    const allowed = career.factualNumbers(current.facts);
    const unbacked = unbackedNumbers(proposal, allowed);

    if (unbacked.length > 0) {
      // Art. 9: the capability stated a number it cannot source. Refused.
      this.log.append(
        {
          type: "ProposalRejected",
          holdId,
          proposal: proposal.title,
          reasons: unbacked.map(
            (n) => `근거 없는 수치: ${String(n)}`,
          ),
        },
        { kind: "system" },
        career.CAPABILITY_ID,
      );
      return;
    }

    this.log.append(
      { type: "ArtifactKept", holdId, artifact: proposal },
      actor,
      career.CAPABILITY_ID,
    );
  }

  /** Answers the outstanding Ask, then resumes. Art. 6: the user decides. */
  answer(optionId: string): { ok: boolean; reason?: string } {
    const ask = this.outstandingAsk();

    if (!ask) {
      return { ok: false, reason: "답변할 질문이 없습니다." };
    }

    if (!ask.options.some((o) => o.id === optionId)) {
      return { ok: false, reason: "선택지에 없는 답변입니다." };
    }

    this.log.append(
      { type: "AskAnswered", holdId: ask.holdId, askId: ask.id, optionId },
      { kind: "user" },
    );

    this.runner.run(() => { this.advance(ask.holdId); });

    return { ok: true };
  }

  /** Art. 18: withdrawal is an append, never a delete. */
  withdraw(holdId: string, reason: string): void {
    this.log.append({ type: "HoldWithdrawn", holdId, reason }, { kind: "user" });
  }
}
