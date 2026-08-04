/**
 * Responsibilities — the unit of accountability.
 *
 * The chain the company is built on:
 *
 *     Employee  →  Responsibility  →  Capability  →  Runner
 *
 * An **employee** owns a responsibility. A **capability** owns business logic. A
 * **runner** executes it. Departments organize employees; they do not resolve
 * them.
 *
 * This separation exists because employees change and capabilities do not. A
 * person leaves, a duty is reassigned, a team grows — none of that may reach the
 * code that decides what the company actually does. Reassigning a responsibility
 * below changes who signs a report and nothing else.
 *
 * Why this file exists at all: the company used to answer "who does this?" by
 * taking the *first employee in the department*. That made a department and a
 * person the same thing, so a department could hold exactly one accountable
 * employee, and a duty that matched nobody silently resolved to whoever was
 * listed first. Both failures were invisible. Assignment is now explicit, typed,
 * and total — an unassigned responsibility is an error, never a default.
 */

import type { Department } from "./employees.ts";

/**
 * Every responsibility the company recognises.
 *
 * A typed union, not a string. A misspelled responsibility is a compile error,
 * which is the whole point: the previous duty strings were Korean literals
 * duplicated between the roster and the runner that used them, and a rename in
 * one place silently misattributed work in the other.
 */
export type ResponsibilityId =
  // Career is a team: one person per stage of an application.
  | "career.job_fit"
  | "career.application_strategy"
  | "career.resume_editor"
  | "career.portfolio_editor"
  | "career.cover_letter"
  | "career.interview_coach"
  | "career.application_operator"
  | "home.provisioning"
  | "finance.ledger-review"
  | "asset.custody"
  | "treasury.capacity"
  | "health.scheduling"
  | "ceo.office"
  | "operations.intake";

export type Responsibility = {
  id: ResponsibilityId;
  /** The department this responsibility sits in. Organizational, not resolving. */
  department: Department;
  /** What the work is called, in the representative's language. */
  label: string;
  /** The employee accountable. Explicit — there is no default and no fallback. */
  employeeId: string;
};

/**
 * The assignment table.
 *
 * One line per responsibility. Replacing an employee is editing one
 * `employeeId` here; nothing in any capability, runner, or report has to know.
 */
export const RESPONSIBILITIES: Responsibility[] = [
  { id: "career.job_fit", department: "career", label: "적합성 분석", employeeId: "emp-career-001" },
  { id: "career.application_strategy", department: "career", label: "지원 전략", employeeId: "emp-career-002" },
  { id: "career.resume_editor", department: "career", label: "이력서 편집", employeeId: "emp-career-003" },
  { id: "career.portfolio_editor", department: "career", label: "포트폴리오 편집", employeeId: "emp-career-007" },
  { id: "career.cover_letter", department: "career", label: "자기소개서", employeeId: "emp-career-004" },
  { id: "career.interview_coach", department: "career", label: "면접 준비", employeeId: "emp-career-005" },
  { id: "career.application_operator", department: "career", label: "지원 관리", employeeId: "emp-career-006" },
  { id: "home.provisioning", department: "home", label: "살림 운영", employeeId: "emp-home-001" },
  { id: "finance.ledger-review", department: "finance", label: "지출 점검", employeeId: "emp-finance-001" },
  { id: "asset.custody", department: "asset", label: "자산 관리", employeeId: "emp-asset-001" },
  { id: "treasury.capacity", department: "treasury", label: "운용 여력", employeeId: "emp-treasury-001" },
  { id: "health.scheduling", department: "health", label: "진료 일정", employeeId: "emp-health-001" },
  { id: "ceo.office", department: "ceo", label: "대표실", employeeId: "emp-ceo-001" },
  { id: "operations.intake", department: "operations", label: "접수", employeeId: "emp-ops-001" },
];

/**
 * Problems in the assignment table itself.
 *
 * Pure, so the rules can be tested against a synthetic table rather than only
 * against the real one. Two invariants:
 *
 *   - a responsibility is declared once, so a lookup cannot be ambiguous
 *   - an employee owns at most one, so a person is never two accountabilities
 *
 * A duplicate is a failure, not a preference for the first or last entry. A
 * table that silently kept one of two conflicting rows is how a wrong owner
 * becomes undiscoverable.
 */
export function assignmentProblems(list: Responsibility[]): string[] {
  const problems: string[] = [];
  const byId = new Set<string>();
  const byEmployee = new Map<string, string>();

  for (const entry of list) {
    if (byId.has(entry.id)) problems.push(`책임이 중복 선언되었습니다: ${entry.id}`);
    byId.add(entry.id);

    if (entry.employeeId.trim() === "") {
      problems.push(`${entry.id}: 담당자가 배정되지 않았습니다`);
      continue;
    }

    const already = byEmployee.get(entry.employeeId);
    if (already) {
      problems.push(`${entry.employeeId}이(가) ${already}와 ${entry.id}를 함께 맡고 있습니다`);
    }
    byEmployee.set(entry.employeeId, entry.id);
  }

  return problems;
}

// The table is checked when it loads. A malformed registry must not reach the
// first lookup, because by then something is already asking for an owner.
const problems = assignmentProblems(RESPONSIBILITIES);
if (problems.length > 0) {
  throw new Error(`책임 배정이 올바르지 않습니다:\n  - ${problems.join("\n  - ")}`);
}

const BY_ID = new Map(RESPONSIBILITIES.map((r) => [r.id, r]));

/** Unknown means unknown. Nothing is guessed, and nothing is defaulted. */
export function responsibility(id: ResponsibilityId): Responsibility {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`배정되지 않은 책임입니다: ${id}`);
  return found;
}

/**
 * Who owns this responsibility.
 *
 * The registry's central question, answered by id alone. Returns the employee
 * id; composing that into a person is the roster's job.
 */
export function ownerOf(id: ResponsibilityId): string {
  return responsibility(id).employeeId;
}

/** The responsibility an employee owns, or null when they own none. */
export function responsibilityOf(employeeId: string): Responsibility | null {
  return RESPONSIBILITIES.find((r) => r.employeeId === employeeId) ?? null;
}

export function knownResponsibility(id: string): id is ResponsibilityId {
  return BY_ID.has(id as ResponsibilityId);
}

/** Responsibilities belonging to a department. Organizational listing only. */
export function responsibilitiesIn(department: Department): Responsibility[] {
  return RESPONSIBILITIES.filter((r) => r.department === department);
}
