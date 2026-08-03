/**
 * Work routing. Operations resolves; nobody else knows the roster.
 *
 * Per AI_COMPANY_ARCHITECTURE §3: the representative never selects a
 * department, one department becomes accountable for the whole request, and the
 * owner — not the router — pulls in whoever else it needs. This module decides
 * exactly one thing: who owns this. Everything it produces is internal and
 * never reaches a surface (§4).
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

export type DepartmentId =
  | "career"
  | "finance"
  | "home"
  | "health"
  | "planning";

type Department = {
  id: DepartmentId;
  /** Words that indicate the decision this work will produce. Strong. */
  decisionSignals: string[];
  /** Words that indicate what the work is about. Weak. */
  subjectSignals: string[];
  /**
   * The capability that executes this department's work today.
   * `null` means the department is defined but not yet staffed.
   */
  capability: string | null;
};

/**
 * Departments, as routing sees them. Function departments (Research,
 * Operations) never appear: they cannot own work, so they are never a routing
 * outcome. Planning appears only as the multi-domain fallback.
 */
const DEPARTMENTS: Department[] = [
  {
    id: "career",
    decisionSignals: ["이력서", "지원", "공고", "채용", "포트폴리오", "면접", "오퍼", "이직"],
    subjectSignals: ["회사", "직무", "경력", "연봉 협상"],
    capability: "career",
  },
  {
    id: "finance",
    decisionSignals: ["결제", "해지", "구독", "송금", "지출", "예산", "청구"],
    subjectSignals: ["카드", "명세", "통장", "요금"],
    capability: null,
  },
  {
    id: "home",
    decisionSignals: ["장보기", "주문", "구매", "재고", "떨어졌", "다 썼"],
    subjectSignals: ["냉장고", "집", "살림", "택배"],
    capability: null,
  },
  {
    id: "health",
    decisionSignals: ["예약", "검진", "진료", "처방"],
    subjectSignals: ["병원", "건강", "약", "증상"],
    capability: null,
  },
  {
    id: "planning",
    decisionSignals: [],
    subjectSignals: [],
    capability: null,
  },
];

export type RoutingDecision = {
  /** Exactly one. Never zero, never two (§3). */
  owner: DepartmentId;
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

  const scored = DEPARTMENTS.filter((d) => d.id !== "planning")
    .map((d) => ({ department: d, ...score(d, text) }))
    .filter((s) => s.decision > 0 || s.subject > 0)
    .sort((a, b) => b.decision - a.decision || b.subject - a.subject);

  const top = scored[0];

  if (!top) {
    // Nothing recognisable. Planning holds it rather than the request bouncing.
    return {
      owner: "planning",
      contributors: [],
      reason: "어느 영역인지 드러나는 신호가 없어 조율 부서가 맡습니다.",
      capability: null,
    };
  }

  const second = scored[1];

  // Two departments with equal decision weight is genuinely multi-domain.
  if (second && second.decision === top.decision && top.decision > 0) {
    return {
      owner: "planning",
      contributors: [top.department.id, second.department.id],
      reason: "결정이 두 영역에 걸쳐 있어 조율 부서가 맡고, 두 팀에 요청합니다.",
      capability: null,
    };
  }

  return {
    owner: top.department.id,
    // The owner asks the rest; the router only notes who is implicated.
    contributors: scored.slice(1).map((s) => s.department.id),
    reason:
      top.decision > 0
        ? "이 요청이 만들어 낼 결정이 이 부서의 것입니다."
        : "요청이 다루는 대상이 이 부서의 영역입니다.",
    capability: top.department.capability,
  };
}

/** True when the owning department can actually execute today. */
export function isStaffed(decision: RoutingDecision): boolean {
  return decision.capability !== null;
}
