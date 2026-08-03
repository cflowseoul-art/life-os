/**
 * Project detection.
 *
 * Not every request is a project. Most are one-off: one handover, one report,
 * done. A **project** is an identity that will own more than one report over
 * time — 이직 준비, 살림, 지출 정리 — and it exists so the representative can
 * see continuity without ever having created a container for it.
 *
 * Per AI_COMPANY_ARCHITECTURE §3: **the representative never creates a project.
 * The company decides.** There is no "new project" action, no naming step, no
 * assignment. A project is recognised, not declared.
 *
 * Detection is a *projection*, derived from recorded facts on every read:
 * nothing about a project is stored, so a project cannot drift from the events
 * that produced it, and recognising one requires no new event type (Art. 11).
 */

import type { EventEnvelope } from "../events/types.ts";

/** The two shapes work can take. Nothing else. */
export type WorkShape = "task" | "project";

export type ProjectMember = {
  holdId: string;
  title: string;
  state: "awaiting" | "inProgress" | "done";
};

export type Project = {
  /** Derived from what it is about, so the same subject always lands together. */
  id: string;
  /** The department accountable for the whole project. Exactly one (§3). */
  owner: string;
  /** What the representative would call it, taken from their own words. */
  name: string;
  members: ProjectMember[];
  /** Why this became a project. Internal; explains the recognition after the fact. */
  reason: string;
  lifecycle: "active" | "dormant" | "closed";
};

/**
 * Words that indicate work extending past a single report.
 *
 * Literal and inspectable. A model may later propose "this is a project", and
 * this module will still decide (Art. 7).
 */
const CONTINUITY_SIGNALS = [
  "준비", "이직", "계속", "매달", "매주", "정기", "당분간",
  "앞으로", "관리", "쭉", "시리즈", "단계",
];

/** Requests that are plainly single-shot, even if they mention continuity. */
const ONE_OFF_SIGNALS = ["한 번만", "이번만", "지금만"];

/**
 * The grouping key. Two requests belong to the same project when the same
 * department owns them and they concern the same subject.
 *
 * Subject is taken from what the representative wrote, not from an internal id,
 * so the identity survives re-implementation of everything below it.
 */
export function subjectKey(owner: string, company: string): string {
  return `${owner}:${company.trim().toLowerCase()}`;
}

type HoldFacts = {
  holdId: string;
  owner: string;
  company: string;
  title: string;
  state: "awaiting" | "inProgress" | "done";
  /** The text the representative handed over. */
  text: string;
  /** How many times this work has needed the representative. */
  askCount: number;
};

/** Reads the log once and reduces it to what detection actually needs. */
export function holdFacts(events: EventEnvelope[]): HoldFacts[] {
  const facts = new Map<string, HoldFacts>();

  for (const { event } of events) {
    if (event.type === "HandedOver") {
      facts.set(event.holdId, {
        holdId: event.holdId,
        owner: event.capability,
        company: event.handover.company,
        title: `${event.handover.company} · ${event.handover.role}`.replace(/ · $/, ""),
        state: "inProgress",
        text: `${event.handover.company} ${event.handover.role} ${event.handover.jdText}`,
        askCount: 0,
      });
      continue;
    }

    const fact = facts.get(event.holdId);
    if (!fact) continue;

    if (event.type === "AskRaised") {
      fact.askCount += 1;
      fact.state = "awaiting";
    }
    if (event.type === "AskAnswered") fact.state = "inProgress";
    if (event.type === "ArtifactKept") fact.state = "done";
    if (event.type === "HoldWithdrawn") facts.delete(event.holdId);
  }

  return [...facts.values()];
}

/**
 * Decides the shape of one piece of work, on its own.
 *
 * Three independent grounds, any one of which is enough:
 *   1. the representative's own words describe continuing work
 *   2. the work has already needed more than one decision
 *   3. it shares a subject with other work under the same department
 *
 * A single request with none of these stays a task, which is the common case
 * and must remain the cheap one.
 */
function shapeOf(fact: HoldFacts, siblings: number): { shape: WorkShape; reason: string } {
  if (ONE_OFF_SIGNALS.some((s) => fact.text.includes(s))) {
    return { shape: "task", reason: "한 번으로 끝나는 요청이라고 하셨습니다." };
  }

  if (siblings > 1) {
    return {
      shape: "project",
      reason: "같은 주제로 요청이 여러 건 이어져, 한 갈래로 묶었습니다.",
    };
  }

  if (fact.askCount > 1) {
    return {
      shape: "project",
      reason: "한 건 안에서 판단이 여러 번 필요해, 이어지는 일로 봅니다.",
    };
  }

  if (CONTINUITY_SIGNALS.some((s) => fact.text.includes(s))) {
    return {
      shape: "project",
      reason: "이어지는 일이라고 말씀하신 표현이 있었습니다.",
    };
  }

  return { shape: "task", reason: "한 번의 보고로 끝나는 일입니다." };
}

/**
 * Recognises projects across everything currently held.
 *
 * Lifecycle is derived, never set:
 *   active  — at least one member is not finished
 *   closed  — every member finished
 *   dormant — finished, but the subject has produced work more than once and
 *             may again; the project keeps its identity rather than vanishing
 */
export function detectProjects(events: EventEnvelope[]): Project[] {
  const facts = holdFacts(events);

  const groups = new Map<string, HoldFacts[]>();
  for (const fact of facts) {
    const key = subjectKey(fact.owner, fact.company);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }

  const projects: Project[] = [];

  for (const [key, members] of groups) {
    const shapes = members.map((m) => shapeOf(m, members.length));
    const project = shapes.find((s) => s.shape === "project");

    if (!project) continue;

    const open = members.filter((m) => m.state !== "done");

    projects.push({
      id: key,
      owner: members[0].owner,
      // The representative's own words, never a generated title.
      name: members[0].company,
      members: members.map((m) => ({ holdId: m.holdId, title: m.title, state: m.state })),
      reason: project.reason,
      lifecycle: open.length > 0 ? "active" : members.length > 1 ? "dormant" : "closed",
    });
  }

  return projects;
}

/** True when this hold is part of a recognised project. */
export function projectFor(projects: Project[], holdId: string): Project | null {
  return projects.find((p) => p.members.some((m) => m.holdId === holdId)) ?? null;
}
