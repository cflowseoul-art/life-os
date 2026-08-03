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

/**
 * How a request finds this capability.
 *
 * Decision signals say what the request will *decide*; subject signals say what
 * it is *about*. A decision signal always wins — that is what keeps "이 오퍼
 * 받아야 할까" with Career rather than with the company it names.
 */
export type RoutingSignals = {
  decisionSignals: string[];
  subjectSignals: string[];
};

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
  /** The words that route work here. Declared with the capability, nowhere else. */
  routing: RoutingSignals;
  /**
   * Where this capability's runner lives. Required when enabled; a department
   * that cannot execute yet declares none.
   */
  runnerModule?: string;
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
    routing: {
      decisionSignals: ["이력서", "지원", "공고", "채용", "포트폴리오", "면접", "오퍼", "이직"],
      subjectSignals: ["회사", "직무", "경력", "연봉 협상"],
    },
    scheduler: "none",
    runnerModule: "../capabilities/career/runner.ts",
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
    routing: {
      decisionSignals: ["장보기", "주문", "구매", "재고", "떨어졌", "다 썼", "영수증", "마트", "장 봤", "사줘", "사 줘", "사다 줘", "사놔", "사둬", "챙겨 줘", "떨어짐", "다 먹었"],
      subjectSignals: ["냉장고", "집", "살림", "택배", "생필품"],
    },
    scheduler: "none",
    runnerModule: "../capabilities/home/runner.ts",
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
    // Scheduled work needs a runner. It becomes "personal" the day it has one.
    routing: {
      decisionSignals: ["예약", "검진", "진료", "처방"],
      subjectSignals: ["병원", "건강", "약", "증상"],
    },
    scheduler: "none",
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
    routing: {
      decisionSignals: ["결제", "해지", "구독", "송금", "지출", "예산", "청구", "명세서", "자동이체", "썼어", "쓴 돈", "많이 썼", "어디에 돈", "소비", "가계부", "고정비", "변동비", "카테고리", "가맹점", "저축이동", "투자이동", "늘었", "줄었"],
      subjectSignals: ["카드", "명세", "요금"],
    },
    scheduler: "household",
    runnerModule: "../capabilities/finance/runner.ts",
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
    routing: {
      decisionSignals: ["잔액", "얼마나 있", "얼마 있", "자산", "순자산", "부채", "빚", "예금", "적금", "통장에", "남아 있", "보유", "받을 돈", "예정 자산"],
      subjectSignals: ["계좌", "통장", "포인트", "대출 잔액"],
    },
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
    routing: {
      decisionSignals: ["운용", "여윳돈", "여유 자금", "굴릴", "굴려", "투자할 수 있", "비상금", "버틸 수 있", "몇 달", "여유가 얼마"],
      subjectSignals: ["운용 가능", "비상 자금"],
    },
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
export function runnerModuleFor(id: string): string {
  const declared = manifestFor(id).runnerModule;
  if (!declared) throw new Error(`${id}: 실행할 러너가 선언되지 않았습니다.`);
  return declared;
}

export function validateManifest(): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  const keywords = new Map<string, string>();

  for (const c of CAPABILITIES) {
    if (seen.has(c.id)) problems.push(`중복 선언: ${c.id}`);
    seen.add(c.id);

    if (c.department.trim() === "") problems.push(`${c.id}: 부서가 없습니다`);
    if (c.scope !== "personal" && c.scope !== "household") problems.push(`${c.id}: scope가 올바르지 않습니다`);
    if (!["none", "household", "personal"].includes(c.scheduler)) problems.push(`${c.id}: scheduler 값이 올바르지 않습니다`);
    if (!Number.isInteger(c.officeFloor) || c.officeFloor < 1 || c.officeFloor > 5) {
      problems.push(`${c.id}: 없는 층입니다 (${String(c.officeFloor)})`);
    }

    // An enabled capability must be able to run; a disabled one must not claim to.
    if (c.enabled && !c.runnerModule) problems.push(`${c.id}: 러너가 선언되지 않았습니다`);
    if (c.scheduler !== "none" && !c.runnerModule) {
      problems.push(`${c.id}: 러너 없이 스케줄될 수 없습니다`);
    }

    // Routing metadata: required to receive work, unique across the company.
    const words = [...c.routing.decisionSignals, ...c.routing.subjectSignals];

    if (c.enabled && c.routing.decisionSignals.length === 0) {
      problems.push(`${c.id}: 라우팅 신호가 비어 있습니다`);
    }

    for (const word of words) {
      if (word.trim() === "") problems.push(`${c.id}: 빈 신호가 있습니다`);
      const owner = keywords.get(word);
      if (owner && owner !== c.id) problems.push(`"${word}" 신호가 ${owner}와 ${c.id}에 중복됩니다`);
      keywords.set(word, c.id);
    }

    const employee = employeeFor(c.department);
    if (employee.id !== c.employeeId) problems.push(`${c.id}: 담당자가 명부와 다릅니다`);
    if (employee.status !== "active") problems.push(`${c.id}: 담당자가 재직 중이 아닙니다`);
  }

  if (problems.length > 0) {
    throw new Error(`capability 선언이 올바르지 않습니다:\n  - ${problems.join("\n  - ")}`);
  }
}
