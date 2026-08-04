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
  /** What this person does inside the department. Not seniority. */
  duty?: string;
  /** Hold id currently carried, when the department runner sets one. */
  currentWork?: string;
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
 * The roster.
 *
 * One accountable employee per department today. A second employee in a
 * department takes the next unused surname and keeps the given name.
 */
const ROSTER: { id: string; department: string; surname: string; title: Title; duty?: string }[] = [
  { id: "emp-finance-001", department: "finance", surname: "Kim", title: "Manager" },
  { id: "emp-asset-001", department: "asset", surname: "Choi", title: "Manager" },
  { id: "emp-treasury-001", department: "treasury", surname: "Oh", title: "Manager" },
  // Career is a team: one person per stage of an application.
  { id: "emp-career-001", department: "career", surname: "Park", title: "Senior", duty: "적합성 분석" },
  { id: "emp-career-002", department: "career", surname: "Lee", title: "Senior", duty: "지원 전략" },
  { id: "emp-career-003", department: "career", surname: "Yoon", title: "Associate", duty: "이력서 편집" },
  { id: "emp-career-004", department: "career", surname: "Shin", title: "Associate", duty: "자기소개서" },
  { id: "emp-career-005", department: "career", surname: "Bae", title: "Associate", duty: "면접 준비" },
  { id: "emp-career-006", department: "career", surname: "Song", title: "Staff", duty: "지원 관리" },
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
  duty?: string,
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
    duty,
    status: "active",
  };
}

function build(entry: (typeof ROSTER)[number]): Employee {
  return compose(entry.id, entry.department, entry.surname, entry.title, entry.duty);
}

export const EMPLOYEES: Employee[] = ROSTER.map(build);

/** The person in a department who does a particular duty. */
export function employeeForDuty(department: string, duty: string): Employee {
  const found = EMPLOYEES.find(
    (e) => e.department === department && e.duty === duty && e.status === "active",
  );
  return found ?? employeeFor(department);
}

/** The employee accountable for a department's work. */
export function employeeFor(department: string): Employee {
  const found = EMPLOYEES.find((e) => e.department === department && e.status === "active");
  if (found) return found;

  // An unstaffed department still has a name, so a report can still be signed.
  // The surname is derived from the department, so it is stable across runs and
  // two departments never end up with the same one by accident.
  const taken = new Set(EMPLOYEES.map((e) => e.surname));
  const free = SURNAMES.filter((s) => !taken.has(s));
  const pool = free.length > 0 ? free : SURNAMES;
  const seed = [...department].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const surname = pool[seed % pool.length];

  return compose(`emp-${department}-000`, department, surname, "Staff");
}

/**
 * How a report is signed — 김재무 팀장.
 *
 * A person and a title, in the representative's language. The department is
 * metadata; the romanized name stays internal.
 */
export function signature(department: string): {
  name: string;
  title: string;
  department: string;
  displayDepartment: string;
} {
  const employee = employeeFor(department);

  return {
    name: employee.displayName,
    title: employee.displayTitle,
    department,
    displayDepartment: employee.displayDepartment,
  };
}
