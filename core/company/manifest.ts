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

import { employeeForResponsibility } from "./employees.ts";
import { knownResponsibility, responsibility } from "./responsibilities.ts";
import type { ResponsibilityId } from "./responsibilities.ts";
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
  /**
   * The responsibilities this capability comprises.
   *
   * The manifest binds responsibilities, not a department: a department is a
   * way of organizing people, and binding one here made a capability and a
   * single person the same thing.
   */
  responsibilities: ResponsibilityId[];
  /**
   * The responsibility accountable for the whole capability. Exactly one (§3).
   * It signs the reports and receives incoming work.
   */
  accountableFor: ResponsibilityId;
  /** Which stream its data belongs to. Declared, never inferred. */
  scope: Scope;
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
   * Where each responsibility's runner lives. Dispatch is by responsibility, so
   * a responsibility that nobody can execute yet simply has no entry here.
   */
  runners?: Partial<Record<ResponsibilityId, string>>;
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
    // Seven stages of an application, seven people. Only job fit can execute
    // today; the rest are declared and unstaffed, which is a fact about the
    // company rather than something to discover at runtime.
    responsibilities: [
      "career.job_fit",
      "career.application_strategy",
      "career.resume_editor",
      "career.portfolio_editor",
      "career.cover_letter",
      "career.interview_coach",
      "career.application_operator",
    ],
    accountableFor: "career.job_fit",
    scope: "personal",
    officeFloor: 1,
    producesReports: true,
    appearsInOffice: true,
    routing: {
      decisionSignals: ["이력서", "지원", "공고", "채용", "포트폴리오", "면접", "오퍼", "이직"],
      subjectSignals: ["회사", "직무", "경력", "연봉 협상"],
    },
    scheduler: "none",
    runners: { "career.job_fit": "../capabilities/career/runner.ts" },
    enabled: true,
  },
  {
    id: "home",
    displayName: "살림",
    responsibilities: ["home.provisioning"],
    accountableFor: "home.provisioning",
    scope: "household",
    officeFloor: 2,
    producesReports: true,
    appearsInOffice: true,
    routing: {
      decisionSignals: ["장보기", "주문", "구매", "재고", "떨어졌", "다 썼", "영수증", "마트", "장 봤", "사줘", "사 줘", "사다 줘", "사놔", "사둬", "챙겨 줘", "떨어짐", "다 먹었"],
      subjectSignals: ["냉장고", "집", "살림", "택배", "생필품"],
    },
    scheduler: "none",
    runners: { "home.provisioning": "../capabilities/home/runner.ts" },
    enabled: true,
  },
  {
    id: "health",
    displayName: "건강",
    responsibilities: ["health.scheduling"],
    accountableFor: "health.scheduling",
    scope: "personal",
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
    responsibilities: ["finance.ledger-review"],
    accountableFor: "finance.ledger-review",
    scope: "household",
    officeFloor: 4,
    producesReports: true,
    appearsInOffice: true,
    routing: {
      decisionSignals: ["결제", "해지", "구독", "송금", "지출", "예산", "청구", "명세서", "자동이체", "썼어", "쓴 돈", "많이 썼", "어디에 돈", "소비", "가계부", "고정비", "변동비", "카테고리", "가맹점", "저축이동", "투자이동", "늘었", "줄었"],
      subjectSignals: ["카드", "명세", "요금"],
    },
    scheduler: "household",
    runners: { "finance.ledger-review": "../capabilities/finance/runner.ts" },
    enabled: true,
  },
  {
    id: "asset",
    displayName: "자산관리",
    responsibilities: ["asset.custody"],
    accountableFor: "asset.custody",
    scope: "household",
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
    responsibilities: ["treasury.capacity"],
    accountableFor: "treasury.capacity",
    scope: "household",
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

/**
 * The responsibility accountable for a capability's work.
 *
 * The single bridge from "which capability" to "which person". Everything that
 * used to ask a department for an employee asks this instead.
 */
export function accountableResponsibility(capability: string): ResponsibilityId {
  return manifestFor(capability).accountableFor;
}

/**
 * The responsibility accountable for work recorded against a name.
 *
 * The name is usually a capability, but work may also be held by a function
 * department that owns none — Operations keeps a request until a domain
 * department can be named — so its own intake responsibility answers instead.
 * Returns null when the name means nothing to the company; the caller decides
 * whether that is an error or simply nobody to display.
 */
export function accountableForWork(name: string): ResponsibilityId | null {
  const intake = `${name}.intake`;
  if (knownResponsibility(intake)) return intake;
  if (!knownCapability(name)) return null;
  return manifestFor(name).accountableFor;
}

/** The department a capability sits in, derived from who is accountable for it. */
export function departmentOf(capability: string): string {
  return responsibility(accountableResponsibility(capability)).department;
}

/** The capability a responsibility belongs to, or null when it belongs to none. */
export function capabilityForResponsibility(id: ResponsibilityId): CapabilityId | null {
  return CAPABILITIES.find((c) => c.responsibilities.includes(id))?.id ?? null;
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
    // The desk shows whoever is accountable, resolved through the
    // responsibility rather than by asking the department for its first name.
    const employee = employeeForResponsibility(c.accountableFor);

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
  const ceo = employeeForResponsibility("ceo.office");
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
/**
 * Where a responsibility's runner lives.
 *
 * Keyed by responsibility, not by capability: a capability is several
 * responsibilities, and only some of them can execute today. A responsibility
 * with no runner is an error at the point of use, never a quiet substitution of
 * somebody else's runner.
 */
export function runnerModuleFor(id: ResponsibilityId): string {
  const capability = capabilityForResponsibility(id);
  if (!capability) throw new Error(`${id}: 어느 capability에도 속하지 않습니다.`);

  const declared = manifestFor(capability).runners?.[id];
  if (!declared) throw new Error(`${id}: 실행할 러너가 선언되지 않았습니다.`);
  return declared;
}

/** Every responsibility that can execute today, with its module. */
export function runnableResponsibilities(): { id: ResponsibilityId; module: string }[] {
  return CAPABILITIES.filter((c) => c.enabled).flatMap((c) =>
    Object.entries(c.runners ?? {}).map(([id, module]) => ({
      id: id as ResponsibilityId,
      module: module,
    })),
  );
}

export function validateManifest(): void {
  const problems: string[] = [];
  const seen = new Set<string>();
  const keywords = new Map<string, string>();
  const claimed = new Map<string, string>();

  for (const c of CAPABILITIES) {
    if (seen.has(c.id)) problems.push(`중복 선언: ${c.id}`);
    seen.add(c.id);

    // Responsibilities: declared, assigned, and owned by exactly one capability.
    if (c.responsibilities.length === 0) problems.push(`${c.id}: 책임이 선언되지 않았습니다`);

    if (!c.responsibilities.includes(c.accountableFor)) {
      problems.push(`${c.id}: 총괄 책임이 선언 목록에 없습니다 (${c.accountableFor})`);
    }

    for (const id of c.responsibilities) {
      if (!knownResponsibility(id)) {
        problems.push(`${c.id}: 등록되지 않은 책임입니다 (${id})`);
        continue;
      }

      const owner = claimed.get(id);
      if (owner && owner !== c.id) problems.push(`책임 ${id}이 ${owner}와 ${c.id}에 중복됩니다`);
      claimed.set(id, c.id);

      // An assignment that cannot resolve to an active employee is a failure at
      // startup, not a name invented at the moment a report needs signing.
      try {
        employeeForResponsibility(id);
      } catch (error) {
        problems.push(`${c.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Every responsibility of a capability sits in one department (§3).
    const departments = new Set(
      c.responsibilities.filter(knownResponsibility).map((id) => responsibility(id).department),
    );
    if (departments.size > 1) {
      problems.push(`${c.id}: 책임이 여러 부서에 걸쳐 있습니다 (${[...departments].join(", ")})`);
    }

    // A runner may only be declared for a responsibility this capability owns.
    for (const id of Object.keys(c.runners ?? {})) {
      if (!c.responsibilities.includes(id as ResponsibilityId)) {
        problems.push(`${c.id}: 맡지 않은 책임의 러너를 선언했습니다 (${id})`);
      }
    }

    if (c.scope !== "personal" && c.scope !== "household") problems.push(`${c.id}: scope가 올바르지 않습니다`);
    if (!["none", "household", "personal"].includes(c.scheduler)) problems.push(`${c.id}: scheduler 값이 올바르지 않습니다`);
    if (!Number.isInteger(c.officeFloor) || c.officeFloor < 1 || c.officeFloor > 5) {
      problems.push(`${c.id}: 없는 층입니다 (${String(c.officeFloor)})`);
    }

    // An enabled capability must be able to run the work it receives, which is
    // the responsibility accountable for it.
    const intakeRunner = c.runners?.[c.accountableFor];
    if (c.enabled && !intakeRunner) problems.push(`${c.id}: 러너가 선언되지 않았습니다`);
    if (c.scheduler !== "none" && !intakeRunner) {
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
  }

  if (problems.length > 0) {
    throw new Error(`capability 선언이 올바르지 않습니다:\n  - ${problems.join("\n  - ")}`);
  }
}
