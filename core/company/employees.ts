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

export type Title = "Manager" | "Deputy Manager" | "Senior" | "Associate" | "Staff" | "Intern";

export type EmployeeStatus = "active" | "leave" | "retired";

export type Employee = {
  /** Stable for the life of the employee. Names may change; this does not. */
  id: string;
  surname: string;
  /** The department's responsibility, as a name. */
  givenName: string;
  fullName: string;
  /** Metadata. Reports are signed by a person, not by a department. */
  department: string;
  title: Title;
  status: EmployeeStatus;
  /** Hold id currently carried, when the department runner sets one. */
  currentWork: string | null;
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
const ROSTER: { id: string; department: string; surname: string; title: Title }[] = [
  { id: "emp-finance-001", department: "finance", surname: "Kim", title: "Manager" },
  { id: "emp-asset-001", department: "asset", surname: "Choi", title: "Manager" },
  { id: "emp-treasury-001", department: "treasury", surname: "Oh", title: "Manager" },
  { id: "emp-career-001", department: "career", surname: "Park", title: "Senior" },
  { id: "emp-home-001", department: "home", surname: "Han", title: "Senior" },
  { id: "emp-health-001", department: "health", surname: "Jung", title: "Associate" },
  { id: "emp-ceo-001", department: "ceo", surname: "Seo", title: "Manager" },
  { id: "emp-ops-001", department: "operations", surname: "Kang", title: "Staff" },
];

function build(entry: (typeof ROSTER)[number]): Employee {
  const givenName = GIVEN_NAME_BY_DEPARTMENT[entry.department] ?? entry.department;

  return {
    id: entry.id,
    surname: entry.surname,
    givenName,
    fullName: `${entry.surname} ${givenName}`,
    department: entry.department,
    title: entry.title,
    status: "active",
    currentWork: null,
  };
}

export const EMPLOYEES: Employee[] = ROSTER.map(build);

/** The employee accountable for a department's work. */
export function employeeFor(department: string): Employee {
  const found = EMPLOYEES.find((e) => e.department === department && e.status === "active");
  if (found) return found;

  // An unstaffed department still has a name, so a report can still be signed.
  // The surname is derived from the department, so it is stable across runs and
  // two departments never end up with the same one by accident.
  const givenName = GIVEN_NAME_BY_DEPARTMENT[department] ?? department;
  const taken = new Set(EMPLOYEES.map((e) => e.surname));
  const free = SURNAMES.filter((s) => !taken.has(s));
  const pool = free.length > 0 ? free : SURNAMES;
  const seed = [...department].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const surname = pool[seed % pool.length];

  return {
    id: `emp-${department}-000`,
    surname,
    givenName,
    fullName: `${surname} ${givenName}`,
    department,
    title: "Staff",
    status: "active",
    currentWork: null,
  };
}

/** Department labels, for places that show the department rather than a person. */
export const DEPARTMENT_LABEL: Record<string, string> = {
  finance: "Finance",
  asset: "Asset Management",
  treasury: "Treasury",
  strategy: "Strategy",
  data: "Data Office",
  audit: "Audit",
  ceo: "CEO Office",
  career: "Career",
  home: "Home",
  health: "Health",
  operations: "Operations",
};

/** How a report is signed: a person and their title, department as metadata. */
export function signature(department: string): { name: string; title: string; department: string } {
  const employee = employeeFor(department);

  return {
    name: employee.fullName,
    title: `${DEPARTMENT_LABEL[department] ?? department} ${employee.title}`,
    department,
  };
}
