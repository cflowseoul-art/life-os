/**
 * The Application Operator's reading of the search.
 *
 * Answers where things stand. It owns operations — which applications exist,
 * what status each is in, what happens next — and nothing about content: it
 * never reads a posting, never scores a fit, and never touches a document.
 *
 * The rule that shapes every function here: **a question about the whole list
 * is not a question about one company.** Asking "지금 지원현황 알려줘" and being
 * asked back "which company?" is the department failing to know its own
 * records. So nothing below takes a company or a position as required input.
 */

import { APPLICATION_STATUSES, STATUS_LABEL } from "./knowledge/types.ts";
import type { ApplicationFact, ApplicationStatus } from "./knowledge/types.ts";
import type { CareerKnowledge } from "./knowledge/index.ts";

/** What the representative asked about. */
export type ApplicationQuery =
  /** Everything, grouped by status. */
  | { kind: "all" }
  /** One slice of the process, named. */
  | { kind: "status"; label: string; statuses: ApplicationStatus[] };

/**
 * Phrases that name a slice of the search.
 *
 * Deliberately query-shaped. A posting says 지원 자격 and 지원 방법; it does not
 * say 지원현황 or 탈락한 곳. Keeping the signals to things only a person asking
 * about their own search would write is what stops a job posting being read as
 * a status question.
 *
 * Order matters: the first match wins, so the narrower phrases come first.
 */
const QUERIES: { signals: string[]; label: string; statuses: ApplicationStatus[] }[] = [
  {
    signals: ["서류합격", "서류 합격", "서류 통과", "서류통과"],
    label: "서류 통과",
    // Everywhere that got past the documents, including places now further on.
    statuses: ["screening", "interview", "offer"],
  },
  {
    signals: ["면접 예정", "면접예정", "면접 잡힌", "면접 있는"],
    label: "면접 예정",
    statuses: ["interview"],
  },
  {
    signals: ["탈락", "떨어진", "불합격"],
    label: "탈락",
    statuses: ["rejected"],
  },
  {
    signals: ["오퍼", "합격한 곳", "최종 합격"],
    label: "오퍼",
    statuses: ["offer"],
  },
];

/** Phrases that ask about the search as a whole. */
const WHOLE_LIST = [
  "지원현황", "지원 현황", "지원 내역", "지원내역", "지원한 곳", "지원 상황",
  "어디까지 진행", "진행 상황", "진행상황",
];

/**
 * Reads what was asked, or null when this is not a status question at all.
 *
 * Null is how a posting stays with the Job Fit Analyst: the operator recognises
 * only questions about the record it keeps.
 */
export function readQuery(text: string): ApplicationQuery | null {
  const asked = text.replace(/\s+/g, " ");

  for (const query of QUERIES) {
    if (query.signals.some((s) => asked.includes(s))) {
      return { kind: "status", label: query.label, statuses: query.statuses };
    }
  }

  return WHOLE_LIST.some((s) => asked.includes(s)) ? { kind: "all" } : null;
}

/** Every phrase the operator answers to. Used by routing, declared once here. */
export const APPLICATION_QUERY_SIGNALS: string[] = [
  ...QUERIES.flatMap((q) => q.signals),
  ...WHOLE_LIST,
];

export type StatusGroup = {
  status: ApplicationStatus;
  label: string;
  applications: ApplicationFact["value"][];
};

export type ApplicationReport = {
  query: ApplicationQuery;
  /** Groups in process order. Statuses with nothing in them are omitted. */
  groups: StatusGroup[];
  /** How many applications the answer covers. */
  total: number;
  /** True when Career keeps no application records at all. */
  empty: boolean;
  summary: string;
};

/** The records, newest movement first inside each group. */
function applicationsIn(
  knowledge: CareerKnowledge,
  statuses: ApplicationStatus[] | null,
): ApplicationFact["value"][] {
  return knowledge
    .factsOfType("application")
    .map((f) => f.value)
    .filter((a) => statuses === null || statuses.includes(a.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.company.localeCompare(b.company));
}

/**
 * Answers a status question from the record.
 *
 * Never asks for anything. When there are no records the answer is that there
 * are none — not a request for a posting, which is a different department's
 * input and would be the operator asking the representative to do its job.
 */
export function reportApplications(
  query: ApplicationQuery,
  knowledge: CareerKnowledge,
): ApplicationReport {
  const held = knowledge.factsOfType("application").length;
  const wanted = query.kind === "all" ? null : query.statuses;
  const matching = applicationsIn(knowledge, wanted);

  const groups: StatusGroup[] = APPLICATION_STATUSES
    .filter((status) => wanted === null || wanted.includes(status))
    .map((status) => ({
      status,
      label: STATUS_LABEL[status],
      applications: matching.filter((a) => a.status === status),
    }))
    .filter((group) => group.applications.length > 0);

  return {
    query,
    groups,
    total: matching.length,
    empty: held === 0,
    summary: summarise(query, held, matching.length),
  };
}

function summarise(query: ApplicationQuery, held: number, matched: number): string {
  if (held === 0) return "기록된 지원 내역이 없습니다.";

  if (query.kind === "all") {
    return `지원 ${String(matched)}건의 현황입니다.`;
  }

  return matched === 0
    ? `${query.label}인 곳은 없습니다.`
    : `${query.label} ${String(matched)}건입니다.`;
}
