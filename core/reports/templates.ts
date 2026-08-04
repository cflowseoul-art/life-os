/**
 * Report templates.
 *
 * One reporting philosophy, many voices. Every template must produce the same
 * envelope — conclusion first, bullets, recommendation, decision only when one
 * is genuinely required — and is free to label and order its own sections.
 *
 * A new team ships a `ReportTemplate` object and nothing else. No surface, no
 * state, no new reporting concept (Art. 15).
 *
 * Templates compose copy from facts the engine already recorded. They never
 * compute, estimate, or invent a value (Art. 9): every bullet is a string the
 * capability observed, and every count is the length of a real array.
 */

import { employeeForResponsibility } from "../company/employees.ts";
import { accountableForWork, producesReports } from "../company/manifest.ts";
import { display as displayCareerFact } from "../capabilities/career/facts.ts";
import { display as displayFinanceFact } from "../capabilities/finance/facts.ts";
import { display as displayHomeFact } from "../capabilities/home/facts.ts";
import type { KnowledgeFact } from "../events/types.ts";

/** What a template is given. Buckets are generic; labels are the team's job. */
export type ReportInput = {
  state: "awaiting" | "inProgress" | "done";
  /**
   * False when the department owns the work but cannot execute it yet. The
   * department still reports: what it has, and what is not yet supported.
   */
  staffed: boolean;
  /** What the capability observed, verbatim. */
  facts: string[];
  /** What the capability produced, in order. Empty until work completes. */
  outcome: string[];
  /** The outstanding question, when the engine raised one. */
  question: string | null;
};

export type ReportSection = { heading: string; bullets: string[] };

/** The envelope. Identical for every team, forever. */
export type ComposedReport = {
  /** 1. Conclusion, one sentence, never a status. */
  summary: string;
  /** 2. Findings, as the team labels them. */
  sections: ReportSection[];
  /** 3. Recommendation. */
  recommendation: string;
  /** 4. Decision required, or null. */
  decision: string | null;
};

export type ReportTemplate = {
  capability: string;
  /** The accountable name that signs this team's reports. */
  contributor: string;
  compose(input: ReportInput): ComposedReport;
  /**
   * One line of readable text for one of this department's facts.
   *
   * The department owns the phrasing, because it owns the vocabulary. No
   * surface may switch on a fact type: a new type changes the department's own
   * `facts.ts` and nothing downstream (§4, Art. 15).
   */
  displayFact(fact: KnowledgeFact): string;
};

/**
 * The last resort, for a department with no template.
 *
 * Prints a legacy prose fact as written and nothing else. It deliberately
 * cannot read a typed value: a department that writes typed facts and supplies
 * no formatter should show blank, not a guessed rendering of someone else's
 * vocabulary.
 */
function displayUnknownFact(fact: KnowledgeFact): string {
  return typeof fact.value === "string" ? fact.value : "";
}

/**
 * The name that signs a capability's reports.
 *
 * Resolved through the responsibility accountable for the work, never by asking
 * a department for whoever it lists first. A name the company does not
 * recognise gets no person at all: inventing one is how an unsigned report used
 * to look signed.
 */
function contributorName(capability: string): string {
  const accountable = accountableForWork(capability);
  return accountable ? employeeForResponsibility(accountable).displayName : "회사";
}

/**
 * A department that owns work it cannot execute yet says so plainly: it keeps
 * the work, states the limit, and names what happens next. Never a refusal.
 */
function notYetStaffed(what: string, next: string): ComposedReport {
  return {
    summary: `${what} 저희 팀이 맡고 있습니다.`,
    sections: [
      {
        heading: "지금 상태",
        bullets: [
          "요청은 그대로 보관돼 있고, 사라지지 않습니다.",
          "아직 저희 쪽에서 대신 처리해 드릴 수 있는 단계가 아닙니다.",
        ],
      },
    ],
    recommendation: `${next} 현재 대표님께 결정을 요청드릴 사항은 없습니다.`,
    decision: null,
  };
}

/** Sections with nothing in them are omitted, never rendered empty. */
function section(heading: string, bullets: string[]): ReportSection[] {
  return bullets.length > 0 ? [{ heading, bullets }] : [];
}

const NO_DECISION = "현재 대표님께 결정을 요청드릴 사항은 없습니다.";

export const career: ReportTemplate = {
  capability: "career",
  contributor: contributorName("career"),
  displayFact: displayCareerFact,
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("이 건은", "준비되는 대로 바로 올려드리겠습니다.");

    // The posting's requirements appear once, as what the draft answers. The
    // draft itself is the deliverable and leads the report.
    // Each stage shows only its own work. A fit report is not a résumé, and a
    // résumé draft does not re-explain the posting.
    const fit = outcome.filter((o) => o.startsWith("적합도 "));
    const strong = outcome.filter((o) => o.startsWith("강한 일치 · ")).map((o) => o.replace("강한 일치 · ", ""));
    const partial = outcome.filter((o) => o.startsWith("부분 일치 · ")).map((o) => o.replace("부분 일치 · ", ""));
    const gaps = outcome.filter((o) => o.startsWith("빈 곳 · ")).map((o) => o.replace("빈 곳 · ", ""));
    const draft = outcome.filter((o) => o.startsWith("초안 · ")).map((o) => o.replace("초안 · ", ""));
    const closed = outcome.filter((o) => o.startsWith("보류로") || o.startsWith("지원하지"));

    const sections = fit.length > 0
      ? [
          ...section("적합도", fit),
          ...section("강한 일치", strong),
          ...section("부분 일치", partial),
          ...section("빈 곳", gaps),
        ]
      : [
          ...section("이력서 첫 문단 초안", draft),
          ...section("결정", closed),
        ];

    if (state === "awaiting") {
      return {
        summary: fit.length > 0
          ? `적합도를 재 봤습니다. ${fit[0]}`
          : "어느 쪽으로 설지 정해 주시면 이력서를 씁니다.",
        sections,
        recommendation: fit.length > 0
          ? "이력서는 아직 손대지 않았습니다. 지원하기로 정하시면 그때 시작합니다."
          : "고르신 방향으로 첫 문단을 쓰겠습니다.",
        decision: question,
      };
    }

    if (state === "done") {
      return {
        summary: fit.length > 0
          ? `적합도를 재 봤습니다. ${fit[0]}`
          : draft.length > 0
            ? "이력서 첫 문단 초안을 올립니다. 〈 〉 부분만 채우시면 그대로 쓰실 수 있습니다."
            : "정하신 대로 처리했습니다.",
        sections,
        recommendation: `확정 전 초안입니다. 고치실 부분을 말씀해 주시면 그대로 반영하겠습니다. ${NO_DECISION}`,
        decision: null,
      };
    }

    return {
      summary:
        facts.length === 0
          ? "보내주신 공고를 읽으며 요건을 뽑고 있습니다."
          : `공고 요건을 정리하고 있습니다. 지금까지 ${String(facts.length)}개를 뽑았습니다.`,
      sections,
      recommendation:
        "지금 대표님께서 하실 일은 없습니다. 첫 문단 순서를 정하실 시점이 오면 바로 올려드리겠습니다.",
      decision: null,
    };
  },
};

/**
 * The teams below are written and registered, and stay dormant until their
 * capability records its first hold. They exist so the next team ships a
 * template, not a reporting system.
 */

export const finance: ReportTemplate = {
  capability: "finance",
  contributor: contributorName("finance"),
  displayFact: displayFinanceFact,
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("지출 관련 건은", "처리할 수 있게 되는 대로 올려드리겠습니다.");

    // Two purposes only: operating policy, and changes worth attention.
    const use = outcome.filter((o) => /^\[관찰\] (고정비|수입)/.test(o));
    const policy = outcome.filter(
      (o) => (o.startsWith("[관찰]") || o.startsWith("[근거]")) && !use.includes(o),
    );
    const changes = outcome.filter((o) => o.startsWith("[추론]"));
    const advice = outcome.filter((o) => o.startsWith("[제안]"));

    const sections = [
      ...section("돈이 어디에 쓰였나", use),
      ...section("운영 기준 점검", policy),
      ...section("눈에 띄는 변화", changes),
      ...section("요청하신 의견", advice),
    ];

    if (state === "awaiting") {
      return {
        summary: "정기 결제 정리는 끝났고, 짚어볼 건이 있어 올립니다.",
        sections,
        recommendation:
          "해지는 제 선에서 하지 않습니다. 정리해 두면 대표님이 직접 진행하시면 됩니다.",
        decision: question,
      };
    }

    if (state === "done") {
      // Every rule kept: the policy section is not rendered at all.
      if (policy.length === 0 && changes.length === 0 && use.length === 0) {
        return {
          summary: "대표님께서 설정하신 운영 기준은 모두 정상입니다.",
          sections: [],
          recommendation: NO_DECISION,
          decision: null,
        };
      }

      return {
        summary:
          policy.length > 0
            ? "운영 기준과 어긋난 항목이 있어 올립니다."
            : changes.length > 0
              ? "대표님께서 설정하신 운영 기준은 모두 정상입니다. 다만 평소와 다른 항목이 있어 올립니다."
              : "대표님께서 설정하신 운영 기준은 모두 정상입니다. 이번 달 사용 내역만 정리해 올립니다.",
        sections,
        recommendation: `모든 숫자는 거래내역 행으로 확인하실 수 있습니다. ${NO_DECISION}`,
        decision: null,
      };
    }

    return {
      summary: "명세를 읽으며 반복되는 결제를 가려내고 있습니다.",
      sections,
      recommendation: NO_DECISION,
      decision: null,
    };
  },
};

export const health: ReportTemplate = {
  capability: "health",
  contributor: contributorName("health"),
  // Health writes no facts yet; legacy prose is all it could have.
  displayFact: displayUnknownFact,
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("건강 관련 건은", "처리할 수 있게 되는 대로 올려드리겠습니다.");

    const sections = [
      ...section("현재 상태", facts),
      ...section("살펴봐야 할 점", outcome),
    ];

    if (state === "awaiting") {
      return {
        summary: "예약 가능한 날짜를 추렸습니다. 하루만 정해 주시면 잡겠습니다.",
        sections,
        recommendation: "일정과 겹치지 않는 날로만 남겨 두었습니다.",
        decision: question,
      };
    }

    return {
      summary: state === "done" ? "예약까지 마쳤습니다." : "가능한 날짜를 일정과 맞춰 보고 있습니다.",
      sections,
      recommendation: NO_DECISION,
      decision: null,
    };
  },
};

export const home: ReportTemplate = {
  capability: "home",
  contributor: contributorName("home"),
  displayFact: displayHomeFact,
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("살림 관련 건은", "처리할 수 있게 되는 대로 올려드리겠습니다.");

    const sections = [
      ...section("구입 품목", facts),
      // Discounts belong to the receipt, not to what is now in the house.
      ...section(
        "재고 반영",
        outcome.filter((o) => !o.startsWith("지출 합계") && !/-[\d,]+원$/.test(o)),
      ),
    ];

    if (state === "awaiting") {
      return {
        summary: "장바구니를 담아 두었습니다. 결제만 승인해 주시면 주문합니다.",
        sections,
        recommendation: "말씀하신 품목만 담았습니다. 그 외에는 넣지 않았습니다.",
        decision: question,
      };
    }

    if (state === "done" && outcome.some((o) => o.startsWith("장보기 목록"))) {
      return {
        summary: "장보기 목록에 올려두었습니다.",
        sections: [...section("장보기 목록", outcome)],
        recommendation: `다음에 장 보실 때 함께 챙기겠습니다. ${NO_DECISION}`,
        decision: null,
      };
    }

    if (state === "done") {
      const spend = outcome.find((o) => o.startsWith("지출 합계")) ?? "";
      // Discounts are recorded facts but are not stocked items.
      const stocked = facts.filter((f) => !f.includes(" · 할인 · ")).length;
      return {
        summary: `영수증 정리했습니다. ${String(stocked)}개 품목을 재고에 반영했습니다.`,
        sections,
        recommendation: `${spend ? `${spend}은 재무팀에 넘겼습니다. ` : ""}${NO_DECISION}`,
        decision: null,
      };
    }

    return {
      summary: "영수증을 읽고 품목을 정리하고 있습니다.",
      sections,
      recommendation: NO_DECISION,
      decision: null,
    };
  },
};

/** Operations holds a request only until a domain department is accountable. */
export const operations: ReportTemplate = {
  capability: "operations",
  contributor: contributorName("operations"),
  // Operations owns no content memory (§2). It has no facts to format.
  displayFact: displayUnknownFact,
  compose: () => notYetStaffed(
    "이 건은",
    "담당 부서가 정해지는 대로 그 팀이 이어받아 올려드리겠습니다.",
  ),
};

const TEMPLATES: ReportTemplate[] = [career, finance, health, home, operations];

/**
 * A capability with no template gets the common envelope and its own name.
 *
 * A capability the manifest says produces no reports gets a template that says
 * so — the rule lives in the manifest, not scattered through the report code.
 */
export function templateFor(capability: string): ReportTemplate {
  if (!producesReports(capability)) {
    return {
      capability,
      contributor: contributorName(capability),
      displayFact: displayUnknownFact,
      compose: () => ({
        summary: "이 일은 보고 대상이 아닙니다.",
        sections: [],
        recommendation: NO_DECISION,
        decision: null,
      }),
    };
  }

  return (
    TEMPLATES.find((t) => t.capability === capability) ?? {
      capability,
      contributor: contributorName(capability),
      displayFact: displayUnknownFact,
      compose: ({ state, staffed, facts, question }) => (!staffed
        ? notYetStaffed("이 건은", "처리할 수 있게 되는 대로 올려드리겠습니다.")
        : {
        summary: state === "done" ? "요청하신 일을 마쳤습니다." : "맡은 일을 진행하고 있습니다.",
        sections: section("확인한 내용", facts),
        recommendation: question === null ? NO_DECISION : "",
        decision: question,
      }),
    }
  );
}
