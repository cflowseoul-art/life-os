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

import type { Scope } from "../identity/types.ts";
import { scopeOf } from "./scope.ts";

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

type Department = {
  id: DepartmentId;
  /** Required. A department with no declared scope cannot exist. */
  scope: Scope;
  /** Words that indicate the decision this work will produce. Strong. */
  decisionSignals: string[];
  /** Words that indicate what the work is about. Weak. */
  subjectSignals: string[];
  /**
   * The capability that executes this department's work today.
   * `null` means the department exists and owns work, but cannot yet execute
   * it. It still takes custody and still reports (§3). Work is never refused
   * because a capability is missing.
   */
  capability: string | null;
};

/**
 * Ownable departments. Function departments (Research, Planning, Operations)
 * are absent by construction: they cannot own work, so they can never be a
 * routing outcome. Operations appears only as a provisional holder, and
 * Planning only as a contributor on multi-department work.
 */
const DEPARTMENTS: Department[] = [
  {
    // State: what is owned or owed right now. Ambiguous "얼마나 있어?" is a
    // question about state, so it belongs here rather than to Finance.
    id: "asset",
    scope: scopeOf("asset"),
    decisionSignals: [
      "잔액", "얼마나 있", "얼마 있", "자산", "순자산", "부채", "빚",
      "예금", "적금", "통장에", "남아 있", "보유", "받을 돈", "예정 자산",
    ],
    subjectSignals: ["계좌", "통장", "포인트", "대출 잔액"],
    capability: "asset",
  },
  {
    // Capacity: what can be put to work. "얼마 있어"는 Asset, "얼마 쓸 수 있어"는 Treasury.
    id: "treasury",
    scope: scopeOf("treasury"),
    decisionSignals: [
      "운용", "여윳돈", "여유 자금", "굴릴", "굴려", "투자할 수 있", "비상금",
      "버틸 수 있", "몇 달", "여유가 얼마",
    ],
    subjectSignals: ["운용 가능", "비상 자금"],
    capability: "treasury",
  },
  {
    id: "career",
    scope: scopeOf("career"),
    decisionSignals: ["이력서", "지원", "공고", "채용", "포트폴리오", "면접", "오퍼", "이직"],
    subjectSignals: ["회사", "직무", "경력", "연봉 협상"],
    capability: "career",
  },
  {
    id: "finance",
    scope: scopeOf("finance"),
    decisionSignals: [
      "결제", "해지", "구독", "송금", "지출", "예산", "청구", "명세서", "자동이체",
      // How money was used — Finance's question, distinct from what is held.
      "썼어", "쓴 돈", "많이 썼", "어디에 돈", "소비", "가계부", "고정비", "변동비",
      "카테고리", "가맹점", "저축이동", "투자이동", "늘었", "줄었",
    ],
    subjectSignals: ["카드", "명세", "통장", "요금"],
    capability: "finance",
  },
  {
    id: "home",
    scope: scopeOf("home"),
    decisionSignals: [
      "장보기", "주문", "구매", "재고", "떨어졌", "다 썼", "영수증", "마트", "장 봤",
      // A request to buy something for the house is Home's, and stops at the list.
      "사줘", "사 줘", "사다 줘", "사놔", "사둬", "챙겨 줘", "떨어짐", "다 먹었",
    ],
    subjectSignals: ["냉장고", "집", "살림", "택배", "생필품"],
    capability: "home",
  },
  {
    id: "health",
    scope: scopeOf("health"),
    decisionSignals: ["예약", "검진", "진료", "처방"],
    subjectSignals: ["병원", "건강", "약", "증상"],
    capability: null,
  },
];

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

  const scored = DEPARTMENTS.filter((d) => d.id !== "operations")
    .map((d) => ({ department: d, ...score(d, text) }))
    .filter((s) => s.decision > 0 || s.subject > 0)
    .sort((a, b) => b.decision - a.decision || b.subject - a.subject);

  const top = scored[0];

  if (!top) {
    // Nothing recognisable yet. Operations coordinates until a domain
    // department can be named. Never a refusal, never a question back.
    return {
      owner: "operations",
      scope: scopeOf("operations"),
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
      scope: top.department.scope,
      provisional: false,
      contributors: ["planning", second.department.id],
      reason: "결정이 두 영역에 걸쳐 있어, 한 부서가 맡고 조율을 함께 붙입니다.",
      capability: top.department.capability,
    };
  }

  return {
    owner: top.department.id,
    scope: top.department.scope,
    provisional: false,
    // The owner asks the rest; the router only notes who is implicated.
    contributors: scored.slice(1).map((s) => s.department.id),
    reason:
      top.decision > 0
        ? "이 요청이 만들어 낼 결정이 이 부서의 것입니다."
        : "요청이 다루는 대상이 이 부서의 영역입니다.",
    capability: top.department.capability,
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
