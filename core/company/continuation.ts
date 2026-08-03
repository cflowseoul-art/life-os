/**
 * Project continuation.
 *
 * When a work item finishes, the owning department asks itself one question:
 * does this project have a natural next step? If it does, the department starts
 * it — silently, on its own authority, without spending the representative's
 * attention (Art. 1). Continuation is internal delegation, not a decision.
 *
 * The representative is asked only when the *new work itself* reaches a fork
 * that needs judgment. Starting work is never such a fork.
 *
 * Rules this module holds itself to:
 *   - only after a work item actually completed
 *   - only inside a recognised project (a one-off has nothing to continue)
 *   - only a step the department can name in advance, never an invented goal
 *   - never twice: the same next step is created once and only once
 *   - never a notification, never a report, never a surface (§4)
 */

import { randomUUID } from "node:crypto";

import { EventLog } from "../events/log.ts";
import type { EventEnvelope } from "../events/types.ts";
import { detectProjects } from "./projects.ts";

/** A step a department knows follows another. Named in advance, never inferred. */
type NextStep = {
  owner: string;
  /** The role just completed. */
  after: string;
  /** The role to start. */
  start: string;
};

/**
 * The company's known sequences.
 *
 * Deliberately short. A department that cannot name its next step in advance
 * does not get to invent one at runtime.
 */
const SEQUENCES: NextStep[] = [
  // Career: a tailored résumé for a posting is followed by preparing for the
  // conversation it exists to produce.
  { owner: "career", after: "프로덕트 디자이너", start: "면접 준비" },
  { owner: "career", after: "시니어 디자이너", start: "면접 준비" },
  { owner: "career", after: "디자이너", start: "면접 준비" },
];

type Completed = { holdId: string; owner: string; company: string; role: string; text: string };

function completedWork(events: EventEnvelope[]): Completed[] {
  const handed = new Map<string, Completed>();
  const done = new Set<string>();

  for (const { event } of events) {
    if (event.type === "HandedOver") {
      handed.set(event.holdId, {
        holdId: event.holdId,
        owner: event.capability,
        company: event.handover.company,
        role: event.handover.role,
        text: event.handover.jdText,
      });
    }
    if (event.type === "ArtifactKept") done.add(event.holdId);
    if (event.type === "HoldWithdrawn") done.delete(event.holdId);
  }

  return [...done].map((id) => handed.get(id)).filter((c): c is Completed => c !== undefined);
}

/** True when this exact next step already exists. Continuation never repeats. */
function alreadyStarted(events: EventEnvelope[], company: string, role: string): boolean {
  return events.some(
    (e) =>
      e.event.type === "HandedOver"
      && e.event.handover.company === company
      && e.event.handover.role === role,
  );
}

/**
 * Runs after work completes. Returns what it started, for inspection only —
 * the caller must not surface it.
 */
export function continueProjects(log: EventLog): { company: string; role: string }[] {
  const events = log.read();
  const projects = detectProjects(events);
  const started: { company: string; role: string }[] = [];

  for (const done of completedWork(events)) {
    // Continuation belongs to a goal. A one-off has nothing to continue.
    const inProject = projects.some((p) => p.members.some((m) => m.holdId === done.holdId));
    if (!inProject) continue;

    const step = SEQUENCES.find(
      (sq) => sq.owner === done.owner && done.role.includes(sq.after),
    );
    if (!step) continue;

    if (alreadyStarted(events, done.company, step.start)) continue;

    // The department starts it on its own authority. Actor is the capability,
    // not the user: the representative did not ask for this and is not told.
    log.append(
      {
        type: "HandedOver",
        holdId: randomUUID(),
        capability: done.owner,
        handover: { company: done.company, role: step.start, jdText: done.text },
      },
      { kind: "capability", id: done.owner },
      done.owner,
      "continuation",
    );

    started.push({ company: done.company, role: step.start });
  }

  return started;
}
