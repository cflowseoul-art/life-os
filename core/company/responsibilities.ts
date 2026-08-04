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
  | "career.fit-analysis"
  | "career.application-strategy"
  | "career.resume-editing"
  | "career.cover-letter"
  | "career.interview-prep"
  | "career.application-operations"
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
  { id: "career.fit-analysis", department: "career", label: "적합성 분석", employeeId: "emp-career-001" },
  { id: "career.application-strategy", department: "career", label: "지원 전략", employeeId: "emp-career-002" },
  { id: "career.resume-editing", department: "career", label: "이력서 편집", employeeId: "emp-career-003" },
  { id: "career.cover-letter", department: "career", label: "자기소개서", employeeId: "emp-career-004" },
  { id: "career.interview-prep", department: "career", label: "면접 준비", employeeId: "emp-career-005" },
  { id: "career.application-operations", department: "career", label: "지원 관리", employeeId: "emp-career-006" },
  { id: "home.provisioning", department: "home", label: "살림 운영", employeeId: "emp-home-001" },
  { id: "finance.ledger-review", department: "finance", label: "지출 점검", employeeId: "emp-finance-001" },
  { id: "asset.custody", department: "asset", label: "자산 관리", employeeId: "emp-asset-001" },
  { id: "treasury.capacity", department: "treasury", label: "운용 여력", employeeId: "emp-treasury-001" },
  { id: "health.scheduling", department: "health", label: "진료 일정", employeeId: "emp-health-001" },
  { id: "ceo.office", department: "ceo", label: "대표실", employeeId: "emp-ceo-001" },
  { id: "operations.intake", department: "operations", label: "접수", employeeId: "emp-ops-001" },
];

const BY_ID = new Map(RESPONSIBILITIES.map((r) => [r.id, r]));

/** Unknown means unknown. Nothing is guessed, and nothing is defaulted. */
export function responsibility(id: ResponsibilityId): Responsibility {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`배정되지 않은 책임입니다: ${id}`);
  return found;
}

export function knownResponsibility(id: string): id is ResponsibilityId {
  return BY_ID.has(id as ResponsibilityId);
}

/** Responsibilities belonging to a department. Organizational listing only. */
export function responsibilitiesIn(department: Department): Responsibility[] {
  return RESPONSIBILITIES.filter((r) => r.department === department);
}
