/**
 * The company's employees.
 *
 * A deterministic naming system, not a cast of characters. No personalities, no
 * biographies, no avatars — an employee is a name, a department, a title, and
 * what they are currently carrying.
 *
 * Convention:
 *   surname     identifies the individual        Kim · Park · Lee · Choi …
 *   given name  states the department's work     Jaemu(재무) · Jasan(자산) …
 *   title       states seniority only            Manager · Staff · Intern …
 *
 * Everyone in a department shares the given name; only the surname changes. So
 * "Kim Jaemu" and "Park Jaemu" are two people doing finance, and the
 * representative can read what someone does without being told.
 *
 * Seniority is never encoded in the name. `Kim Jaemu (Manager)` and
 * `Lee Jaemu (Staff)` differ by title alone.
 */

import { RESPONSIBILITIES, responsibility, responsibilityOf } from "./responsibilities.ts";
import type { ResponsibilityId } from "./responsibilities.ts";

export type EmployeeTitle =
  | "Manager" | "Deputy Manager" | "Senior" | "Associate" | "Staff" | "Intern";

/** Kept for the older import name. */
export type Title = EmployeeTitle;

export type Department =
  | "finance" | "asset" | "treasury" | "strategy" | "data" | "audit"
  | "ceo" | "career" | "home" | "health" | "operations";

export type EmployeeStatus = "active" | "leave" | "retired";

export type Employee = {
  /** Stable for the life of the employee. Names may change; this does not. */
  id: string;

  /** Internal, developer-facing. Never shown to the representative. */
  surname: string;
  givenName: string;
  fullName: string;

  /** What the representative actually reads. */
  displaySurname: string;
  displayGivenName: string;
  displayName: string;

  /** Metadata. Reports are signed by a person, not by a department. */
  department: Department | string;
  title: EmployeeTitle;
  displayDepartment: string;
  displayTitle: string;

  status: EmployeeStatus;
};

/**
 * Given names, by responsibility.
 *
 * Adding a department means adding one line here. Nothing else in the company
 * needs to know the name.
 */
export const GIVEN_NAME_BY_DEPARTMENT: Record<string, string> = {
  finance: "Jaemu",       // 재무 — how money was used
  asset: "Jasan",         // 자산 — what is owned or owed
  treasury: "Unyong",     // 운용 — what can be put to work
  strategy: "Jeonryak",   // 전략
  data: "Data",           // 데이터
  audit: "Gamsa",         // 감사
  ceo: "Biseo",           // 비서 — CEO office
  career: "Jinro",        // 진로 — the representative's career
  home: "Salim",          // 살림 — the household
  health: "Geongang",     // 건강
  operations: "Chongmu",  // 총무 — keeps the company running
};

/** Departments, as the representative reads them. */
export const DEPARTMENT_LABEL: Record<string, string> = {
  finance: "재무팀",
  asset: "자산관리팀",
  treasury: "자산운용팀",
  strategy: "전략팀",
  data: "데이터팀",
  audit: "감사팀",
  ceo: "대표실",
  career: "커리어팀",
  home: "살림팀",
  health: "건강팀",
  operations: "총무팀",
};

/** The same given names as the representative reads them. */
export const DISPLAY_GIVEN_NAME: Record<string, string> = {
  Jaemu: "재무",
  Jasan: "자산",
  Unyong: "운용",
  Jeonryak: "전략",
  Data: "데이터",
  Gamsa: "감사",
  Biseo: "비서",
  Jinro: "진로",
  Salim: "살림",
  Geongang: "건강",
  Chongmu: "총무",
};

export const DISPLAY_SURNAME: Record<string, string> = {
  Kim: "김", Park: "박", Lee: "이", Choi: "최", Jung: "정",
  Han: "한", Seo: "서", Kang: "강", Cho: "조", Yoon: "윤",
  Oh: "오", Shin: "신", Im: "임", Bae: "배", Song: "송",
  Nam: "남", Hwang: "황", Ahn: "안", Moon: "문", Baek: "백",
};

/** Seniority, as it is said out loud. */
export const DISPLAY_TITLE: Record<EmployeeTitle, string> = {
  Manager: "팀장",
  "Deputy Manager": "부팀장",
  Senior: "선임",
  Associate: "대리",
  Staff: "사원",
  Intern: "인턴",
};

/** 대표실은 팀이 아니라 실이라, 같은 직급도 다르게 불립니다. */
const TITLE_OVERRIDE: Record<string, Partial<Record<EmployeeTitle, string>>> = {
  ceo: { Manager: "실장" },
};

/** Surnames, in assignment order. Extend the pool; never reorder it. */
export const SURNAMES = [
  "Kim", "Park", "Lee", "Choi", "Jung", "Han", "Seo", "Kang", "Cho", "Yoon",
  "Oh", "Shin", "Im", "Bae", "Song", "Nam", "Hwang", "Ahn", "Moon", "Baek",
];

/**
 * The roster — who works here.
 *
 * Only that. What each person is accountable for lives in
 * `responsibilities.ts`, because an employee and a responsibility change on
 * different schedules and for different reasons. The order of this list carries
 * no meaning: nothing resolves an employee by being listed first.
 */
const ROSTER: { id: string; department: Department; surname: string; title: Title }[] = [
  { id: "emp-finance-001", department: "finance", surname: "Kim", title: "Manager" },
  { id: "emp-asset-001", department: "asset", surname: "Choi", title: "Manager" },
  { id: "emp-treasury-001", department: "treasury", surname: "Oh", title: "Manager" },
  // Career is a team: one person per stage of an application.
  { id: "emp-career-001", department: "career", surname: "Park", title: "Senior" },
  { id: "emp-career-002", department: "career", surname: "Lee", title: "Senior" },
  { id: "emp-career-003", department: "career", surname: "Yoon", title: "Associate" },
  { id: "emp-career-004", department: "career", surname: "Shin", title: "Associate" },
  { id: "emp-career-005", department: "career", surname: "Bae", title: "Associate" },
  { id: "emp-career-006", department: "career", surname: "Song", title: "Staff" },
  { id: "emp-career-007", department: "career", surname: "Cho", title: "Associate" },
  { id: "emp-home-001", department: "home", surname: "Han", title: "Senior" },
  { id: "emp-health-001", department: "health", surname: "Jung", title: "Associate" },
  { id: "emp-ceo-001", department: "ceo", surname: "Seo", title: "Manager" },
  { id: "emp-ops-001", department: "operations", surname: "Kang", title: "Staff" },
];

function compose(
  id: string,
  department: string,
  surname: string,
  title: EmployeeTitle,
): Employee {
  const givenName = GIVEN_NAME_BY_DEPARTMENT[department] ?? department;
  const displaySurname = DISPLAY_SURNAME[surname] ?? surname;
  const displayGivenName = DISPLAY_GIVEN_NAME[givenName] ?? givenName;

  return {
    id,
    surname,
    givenName,
    fullName: `${surname} ${givenName}`,
    // 김재무 — surname and responsibility, read as one name.
    displaySurname,
    displayGivenName,
    displayName: `${displaySurname}${displayGivenName}`,
    department,
    title,
    displayDepartment: DEPARTMENT_LABEL[department] ?? department,
    displayTitle: TITLE_OVERRIDE[department]?.[title] ?? DISPLAY_TITLE[title],
    status: "active",
  };
}

function build(entry: (typeof ROSTER)[number]): Employee {
  return compose(entry.id, entry.department, entry.surname, entry.title);
}

export const EMPLOYEES: Employee[] = ROSTER.map(build);

/**
 * Problems in the roster's relationship to the assignment table.
 *
 * Pure, so the rule can be tested against synthetic input. The rule is a
 * bijection: every employee owns exactly one responsibility, and every
 * responsibility is owned by somebody on the roster.
 *
 * An employee with no responsibility is the failure this exists to catch. They
 * used to be reachable anyway — a department lookup would return them if they
 * happened to be listed first — so an unassigned person could do work nobody
 * had made them accountable for.
 */
export function rosterProblems(
  employees: { id: string }[],
  assignments: { id: string; employeeId: string }[],
): string[] {
  const problems: string[] = [];
  const onRoster = new Set(employees.map((e) => e.id));
  const owned = new Map(assignments.map((a) => [a.employeeId, a.id]));

  for (const employee of employees) {
    if (!owned.has(employee.id)) problems.push(`${employee.id}: 맡은 책임이 없습니다`);
  }

  for (const assignment of assignments) {
    if (!onRoster.has(assignment.employeeId)) {
      problems.push(`${assignment.id}: 명부에 없는 담당자입니다 (${assignment.employeeId})`);
    }
  }

  return problems;
}

// Checked when the module loads: an unassigned employee must never reach a
// lookup, because a lookup is already somebody asking who is accountable.
const problems = rosterProblems(ROSTER, RESPONSIBILITIES);
if (problems.length > 0) {
  throw new Error(`명부와 책임 배정이 어긋납니다:\n  - ${problems.join("\n  - ")}`);
}

const BY_ID = new Map(EMPLOYEES.map((e) => [e.id, e]));

/**
 * One employee, by id.
 *
 * Throws rather than inventing a person. A roster that cannot answer who
 * somebody is has a real problem, and the previous behaviour — deriving a
 * surname from the department name so a report could still be signed — hid it
 * behind a plausible-looking name.
 */
export function employeeById(id: string): Employee {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`명부에 없는 담당자입니다: ${id}`);
  if (found.status !== "active") throw new Error(`재직 중이 아닌 담당자입니다: ${id}`);
  return found;
}

/**
 * The employee accountable for a responsibility.
 *
 * The only way to reach a person. There is deliberately no lookup by
 * department: a department organizes employees, it does not stand in for one,
 * and treating the two as interchangeable is what limited every department to a
 * single accountable name.
 */
export function employeeForResponsibility(id: ResponsibilityId): Employee {
  return employeeById(responsibility(id).employeeId);
}

/** What an employee is accountable for. Throws rather than reporting nothing. */
export function responsibilityOwnedBy(employeeId: string): ResponsibilityId {
  const found = responsibilityOf(employeeId);
  if (!found) throw new Error(`맡은 책임이 없는 담당자입니다: ${employeeId}`);
  return found.id;
}

/**
 * How a report is signed — 김재무 팀장.
 *
 * Signed by the person accountable for the responsibility, never by the
 * department. Two responsibilities in one department produce two different
 * signatures, which is the point.
 */
export function signature(id: ResponsibilityId): {
  name: string;
  title: string;
  responsibility: ResponsibilityId;
  department: string;
  displayDepartment: string;
} {
  const employee = employeeForResponsibility(id);

  return {
    name: employee.displayName,
    title: employee.displayTitle,
    responsibility: id,
    department: String(employee.department),
    displayDepartment: employee.displayDepartment,
  };
}
