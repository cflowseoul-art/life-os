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
};

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
  contributor: "서junior",
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("이 건은", "준비되는 대로 바로 올려드리겠습니다.");

    const sections = [
      ...section("공고 요건", facts),
      ...section("추천 포지셔닝", outcome),
    ];

    if (state === "awaiting") {
      return {
        summary: "첫 문단에 무엇을 앞세울지 하나만 정해 주시면, 이력서 정리는 끝납니다.",
        sections,
        recommendation:
          "두 가지로 좁혀 두었습니다. 어느 쪽으로 기억되고 싶으신지에 달린 문제라 제가 정하지 않았습니다.",
        decision: question,
      };
    }

    if (state === "done") {
      return {
        summary: `이력서 정리본이 준비됐습니다. 정해 주신 순서 그대로 ${String(outcome.length)}개 항목을 배치했습니다.`,
        sections,
        recommendation: `이대로 쓰셔도 됩니다. 제출은 대표님이 하실 때 따로 여쭙겠습니다. ${NO_DECISION}`,
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
  contributor: "윤senior",
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("지출 관련 건은", "처리할 수 있게 되는 대로 올려드리겠습니다.");

    const sections = [
      ...section("핵심 수치", facts),
      ...section("분석", outcome),
    ];

    if (state === "awaiting") {
      return {
        summary: "정리는 끝났고, 해지 여부만 정해 주시면 됩니다.",
        sections,
        recommendation: "금액이 나가는 건이라 제 선에서 처리하지 않고 올립니다.",
        decision: question,
      };
    }

    return {
      summary:
        state === "done"
          ? "지출 정리를 마쳤습니다."
          : "명세를 대조하며 나가는 돈을 정리하고 있습니다.",
      sections,
      recommendation: NO_DECISION,
      decision: null,
    };
  },
};

export const health: ReportTemplate = {
  capability: "health",
  contributor: "민경",
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
  contributor: "한별",
  compose({ state, staffed, facts, outcome, question }) {
    if (!staffed) return notYetStaffed("살림 관련 건은", "처리할 수 있게 되는 대로 올려드리겠습니다.");

    const sections = [
      ...section("구입 품목", facts),
      ...section("재고 반영", outcome.filter((o) => !o.startsWith("지출 합계"))),
    ];

    if (state === "awaiting") {
      return {
        summary: "장바구니를 담아 두었습니다. 결제만 승인해 주시면 주문합니다.",
        sections,
        recommendation: "말씀하신 품목만 담았습니다. 그 외에는 넣지 않았습니다.",
        decision: question,
      };
    }

    if (state === "done") {
      const spend = outcome.find((o) => o.startsWith("지출 합계")) ?? "";
      return {
        summary: `영수증 정리했습니다. ${String(facts.length)}개 품목을 재고에 반영했습니다.`,
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
  contributor: "운영",
  compose: () => notYetStaffed(
    "이 건은",
    "담당 부서가 정해지는 대로 그 팀이 이어받아 올려드리겠습니다.",
  ),
};

const TEMPLATES: ReportTemplate[] = [career, finance, health, home, operations];

/** A capability with no template gets the common envelope and its own name. */
export function templateFor(capability: string): ReportTemplate {
  return (
    TEMPLATES.find((t) => t.capability === capability) ?? {
      capability,
      contributor: capability,
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
