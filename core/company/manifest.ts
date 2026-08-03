/**
 * The capability manifest.
 *
 * Every capability is declared here once, and every other part of the company
 * reads the declaration: routing, scope, the office, the scheduler, reports.
 * Metadata written twice is metadata that will disagree.
 *
 * Adding a capability is adding one entry. Forgetting a field is a compile
 * error; declaring something impossible is a startup failure. There is no
 * fallback and no default — an unknown capability is not a capability.
 */

import { employeeFor } from "./employees.ts";
import type { Scope } from "../identity/types.ts";

export type CapabilityId =
  | "career" | "home" | "finance" | "asset" | "treasury" | "health";

/** How a capability is woken up when nobody asked. */
export type SchedulerKind = "none" | "household" | "personal";

export type CapabilityManifest = {
  id: CapabilityId;
  /** What the representative calls it. */
  displayName: string;
  /** The accountable department. One, always. */
  department: string;
  /** Which stream its data belongs to. Declared, never inferred. */
  scope: Scope;
  /** The employee who signs its reports. Resolved from the roster. */
  employeeId: string;
  /** Which floor its desk is on. Ordered by how often the team reports. */
  officeFloor: number;
  /** Whether it may put a report in front of the representative. */
  producesReports: boolean;
  /** Whether it has a desk at all. */
  appearsInOffice: boolean;
  scheduler: SchedulerKind;
  /** Whether it can accept work today. A department may exist unstaffed. */
  enabled: boolean;
};

/**
 * The company as it actually is.
 *
 * `enabled: false` means the department exists and owns work but cannot
 * execute it yet — it still reports that fact, which is why it keeps an
 * employee and a floor.
 */
export const CAPABILITIES: CapabilityManifest[] = [
  {
    id: "career",
    displayName: "커리어",
    department: "career",
    scope: "personal",
    employeeId: employeeFor("career").id,
    officeFloor: 1,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "none",
    enabled: true,
  },
  {
    id: "home",
    displayName: "살림",
    department: "home",
    scope: "household",
    employeeId: employeeFor("home").id,
    officeFloor: 2,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "none",
    enabled: true,
  },
  {
    id: "health",
    displayName: "건강",
    department: "health",
    scope: "personal",
    employeeId: employeeFor("health").id,
    officeFloor: 2,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "personal",
    enabled: false,
  },
  {
    id: "finance",
    displayName: "재무",
    department: "finance",
    scope: "household",
    employeeId: employeeFor("finance").id,
    officeFloor: 4,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "household",
    enabled: true,
  },
  {
    id: "asset",
    displayName: "자산관리",
    department: "asset",
    scope: "household",
    employeeId: employeeFor("asset").id,
    officeFloor: 4,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "none",
    enabled: false,
  },
  {
    id: "treasury",
    displayName: "자산운용",
    department: "treasury",
    scope: "household",
    employeeId: employeeFor("treasury").id,
    officeFloor: 3,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "none",
    enabled: false,
  },
];

const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

/** Unknown means unknown. Nothing is guessed, and nothing is defaulted. */
export function manifestFor(id: string): CapabilityManifest {
  const found = BY_ID.get(id as CapabilityId);
  if (!found) throw new Error(`등록되지 않은 capability입니다: ${id}`);
  return found;
}

export function knownCapability(id: string): boolean {
  return BY_ID.has(id as CapabilityId);
}

export function scopeOf(id: string): Scope {
  return manifestFor(id).scope;
}

export function isEnabled(id: string): boolean {
  return knownCapability(id) && manifestFor(id).enabled;
}

export function producesReports(id: string): boolean {
  return knownCapability(id) && manifestFor(id).producesReports;
}

export function appearsInOffice(id: string): boolean {
  return knownCapability(id) && manifestFor(id).appearsInOffice;
}

/** Capabilities the scheduler may wake, by how they are scheduled. */
export function scheduled(kind: Exclude<SchedulerKind, "none">): CapabilityManifest[] {
  return CAPABILITIES.filter((c) => c.enabled && c.scheduler === kind);
}

/** The company's desks: one per capability that has one, ordered top floor first. */
export function companyRoster(): {
  id: string;
  name: string;
  title: string;
  department: string;
  departmentLabel: string;
  floor: string;
  capability: CapabilityId;
}[] {
  const desks = CAPABILITIES.filter((c) => c.appearsInOffice).map((c) => {
    const employee = employeeFor(c.department);

    return {
      id: employee.id,
      name: employee.displayName,
      title: employee.displayTitle,
      department: String(employee.department),
      departmentLabel: employee.displayDepartment,
      floor: `${String(c.officeFloor)}F`,
      capability: c.id,
    };
  });

  // The CEO office is not a capability; it is where the representative sits.
  const ceo = employeeFor("ceo");
  desks.push({
    id: ceo.id,
    name: ceo.displayName,
    title: ceo.displayTitle,
    department: String(ceo.department),
    departmentLabel: ceo.displayDepartment,
    floor: "5F",
    capability: "career",
  });

  return desks.sort((a, b) => b.floor.localeCompare(a.floor));
}

/**
 * Startup validation. The company refuses to start if its own description is
 * inconsistent — a silent misconfiguration would be discovered by a user.
 */
export function validateManifest(): void {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const c of CAPABILITIES) {
    if (seen.has(c.id)) problems.push(`중복 선언: ${c.id}`);
    seen.add(c.id);

    if (c.department.trim() === "") problems.push(`${c.id}: 부서가 없습니다`);
    if (c.scope !== "personal" && c.scope !== "household") problems.push(`${c.id}: scope가 올바르지 않습니다`);
    if (!["none", "household", "personal"].includes(c.scheduler)) problems.push(`${c.id}: scheduler 값이 올바르지 않습니다`);
    if (!Number.isInteger(c.officeFloor) || c.officeFloor < 1 || c.officeFloor > 5) {
      problems.push(`${c.id}: 없는 층입니다 (${String(c.officeFloor)})`);
    }

    const employee = employeeFor(c.department);
    if (employee.id !== c.employeeId) problems.push(`${c.id}: 담당자가 명부와 다릅니다`);
    if (employee.status !== "active") problems.push(`${c.id}: 담당자가 재직 중이 아닙니다`);
  }

  if (problems.length > 0) {
    throw new Error(`capability 선언이 올바르지 않습니다:\n  - ${problems.join("\n  - ")}`);
  }
}
