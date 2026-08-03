/**
 * Work routing. Operations resolves; nobody else knows the roster.
 *
 * Per AI_COMPANY_ARCHITECTURE §3: the representative never selects a
 * department, one department becomes accountable for the whole request, and the
 * owner — not the router — pulls in whoever else it needs. This module decides
 * exactly one thing: who owns this. Everything it produces is internal and
 * never reaches a surface (§4).
 *
 * Routing decides one thing: which capability should handle this. Scope, floor,
 * employee, scheduler and reports are the manifest's business, not routing's.
 *
 * Routing reads the request for the *decision it will produce*, not merely its
 * subject: "이 오퍼 받아야 할까" is about a job and produces a life decision, so
 * subject-matching alone would misroute exactly the requests that matter most.
 * Signals below are therefore split into decision signals (strong) and subject
 * signals (weak), and a decision signal wins.
 *
 * There is no model here. Rules are literal and inspectable, so a routing
 * outcome can always be explained after the fact (Art. 8). When a model is
 * wired in, it proposes a department and this module still decides (Art. 7).
 */

import type { Scope } from "../identity/types.ts";
import { CAPABILITIES, isEnabled, manifestFor } from "./manifest.ts";

export type DepartmentId =
  | "asset"
  | "treasury"
  | "career"
  | "finance"
  | "home"
  | "health"
  /** Coordinates multi-department work. Never owns. */
  | "planning"
  /** Coordinates provisionally until a domain department is accountable. */
  | "operations";

/** A department as routing sees it: an id and the words that reach it. */
type Department = {
  id: DepartmentId;
  decisionSignals: string[];
  subjectSignals: string[];
};

/**
 * The departments that can own work, read from the manifest.
 *
 * Function departments (Research, Planning, Operations) are absent by
 * construction: they declare no capability, so they can never be an outcome.
 */
function departments(): Department[] {
  return CAPABILITIES.map((c) => ({
    id: c.id as DepartmentId,
    decisionSignals: c.routing.decisionSignals,
    subjectSignals: c.routing.subjectSignals,
  }));
}

export type RoutingDecision = {
  /** Exactly one. Never zero, never two (§3). */
  owner: DepartmentId;
  /** Which stream this work belongs in. Decided by the department, not the user. */
  scope: Scope;
  /**
   * True while Operations is holding the request because no domain department
   * is yet accountable. Temporary by construction: ownership transfers as soon
   * as a domain department can be named, silently (§3).
   */
  provisional: boolean;
  /** Departments the owner will ask. Internal; never surfaced (§4). */
  contributors: DepartmentId[];
  /** Why this owner, in one line. For inspection after the fact, not for display. */
  reason: string;
  /** The capability that can execute this today, or null if unstaffed. */
  capability: string | null;
};

function score(department: Department, text: string): { decision: number; subject: number } {
  return {
    decision: department.decisionSignals.filter((s) => text.includes(s)).length,
    subject: department.subjectSignals.filter((s) => text.includes(s)).length,
  };
}

/**
 * Reads a request and names its owner.
 *
 * A decision signal always beats a subject signal, so work is owned by the
 * department accountable for what the representative will eventually decide.
 * Multi-domain work with no dominant owner goes to Planning — the exception
 * that proves single accountability, not a routine outcome.
 */
export function route(request: { subject?: string; body?: string; attachment?: string }): RoutingDecision {
  const text = [request.subject ?? "", request.body ?? "", request.attachment ?? ""].join("\n");

  const scored = departments()
    .map((d) => ({ department: d, ...score(d, text) }))
    .filter((s) => s.decision > 0 || s.subject > 0)
    .sort((a, b) => b.decision - a.decision || b.subject - a.subject);

  const top = scored[0];

  if (!top) {
    // Nothing recognisable yet. Operations coordinates until a domain
    // department can be named. Never a refusal, never a question back.
    return {
      owner: "operations",
      scope: "household",
      provisional: true,
      contributors: [],
      reason: "아직 담당 부서가 정해지지 않아 운영이 임시로 맡습니다.",
      capability: null,
    };
  }

  const second = scored[1];

  // Genuinely multi-domain. Planning coordinates but never owns, so the first
  // department still carries accountability and still signs the report.
  if (second && second.decision === top.decision && top.decision > 0) {
    return {
      owner: top.department.id,
      scope: manifestFor(top.department.id).scope,
      provisional: false,
      contributors: ["planning", second.department.id],
      reason: "결정이 두 영역에 걸쳐 있어, 한 부서가 맡고 조율을 함께 붙입니다.",
      capability: isEnabled(top.department.id) ? top.department.id : null,
    };
  }

  return {
    owner: top.department.id,
    scope: manifestFor(top.department.id).scope,
    provisional: false,
    // The owner asks the rest; the router only notes who is implicated.
    contributors: scored.slice(1).map((s) => s.department.id),
    reason:
      top.decision > 0
        ? "이 요청이 만들어 낼 결정이 이 부서의 것입니다."
        : "요청이 다루는 대상이 이 부서의 영역입니다.",
    capability: isEnabled(top.department.id) ? top.department.id : null,
  };
}

/**
 * True when the owning department can execute today.
 *
 * False is not a refusal. The department still owns the work, still takes
 * custody, and still reports what it can and cannot yet do.
 */
export function isStaffed(decision: RoutingDecision): boolean {
  return decision.capability !== null;
}
