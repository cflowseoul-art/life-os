/**
 * The Application Operator, as executable checks.
 *
 * What must hold: a question about the whole search is answered from the
 * record, never with a question back; each status filter selects what it says;
 * an empty record says it is empty rather than asking for a posting; and a
 * posting still reaches the Job Fit Analyst.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  APPLICATION_QUERY_SIGNALS,
  readQuery,
  reportApplications,
} from "./capabilities/career/applications.ts";
import { runner as operator } from "./capabilities/career/application-operator.ts";
import { careerKnowledge, InMemoryRepository } from "./capabilities/career/knowledge/index.ts";
import { careerKnowledgeFor } from "./capabilities/career/knowledge/provider.ts";
import { responsibilityForRequest } from "./company/manifest.ts";
import { route } from "./company/routing.ts";
import type {
  ApplicationFact,
  ApplicationStatus,
  RepresentativeKey,
} from "./capabilities/career/knowledge/index.ts";
import type { ActorContext } from "./identity/types.ts";

const OWNER: RepresentativeKey = { householdId: "hh-1", userId: "usr-1" };
const SEED_EMAIL = "owner@example.com";
process.env.LIFE_OS_CAREER_SEED_EMAIL = SEED_EMAIL;

const ACTOR = {
  user: { id: "usr-1", email: SEED_EMAIL },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

function application(
  company: string,
  status: ApplicationStatus,
  over: Partial<ApplicationFact["value"]> = {},
): ApplicationFact {
  return {
    id: `app-${company}`,
    type: "application",
    value: {
      company,
      position: "Data Analyst",
      status,
      appliedAt: "2026-07-01",
      nextStep: null,
      interviewAt: null,
      memo: null,
      updatedAt: `2026-07-0${String(company.length)}`,
      ...over,
    },
    source: "career-knowledge:applications",
    author: { kind: "representative" },
    acquiredAt: "2026-07-01T00:00:00.000Z",
    confidence: 1,
  };
}

const RECORDS = [
  application("토스", "applied"),
  application("당근", "screening"),
  application("배민", "interview", { interviewAt: "2026-08-10" }),
  application("네이버", "interview", { interviewAt: "2026-08-12" }),
  application("카카오", "rejected"),
  application("쿠팡", "offer"),
  application("라인", "planned", { appliedAt: null }),
];

const KNOWLEDGE = careerKnowledge(new InMemoryRepository(OWNER, RECORDS), OWNER);
const EMPTY = careerKnowledge(new InMemoryRepository(OWNER), OWNER);

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-app-")), "events.jsonl"));
}

function ask(log: EventLog, question: string) {
  operator.accept({ actor: ACTOR, log, subject: question, request: "", attachment: "" });

  const kept = log.read().filter((e) => e.event.type === "ArtifactKept");
  const last = kept[kept.length - 1];
  if (last?.event.type !== "ArtifactKept") throw new Error("no artifact");
  return last.event.artifact;
}

describe("지금 지원현황 알려줘", () => {
  it("reads as a question about the whole list", () => {
    expect(readQuery("지금 지원현황 알려줘")).toEqual({ kind: "all" });
    expect(readQuery("지원 내역 보여줘")).toEqual({ kind: "all" });
    expect(readQuery("어디까지 진행됐어?")).toEqual({ kind: "all" });
  });

  it("returns every application, grouped by status", () => {
    const report = reportApplications({ kind: "all" }, KNOWLEDGE);

    expect(report.total).toBe(RECORDS.length);
    expect(report.groups.map((g) => g.status)).toEqual([
      "planned", "applied", "screening", "interview", "offer", "rejected",
    ]);
    expect(report.summary).toContain("7건");
  });

  it("groups in process order and omits statuses holding nothing", () => {
    const report = reportApplications({ kind: "all" }, KNOWLEDGE);

    // Nothing was withdrawn, so no empty 지원 철회 group is rendered.
    expect(report.groups.map((g) => g.status)).not.toContain("withdrawn");
    for (const group of report.groups) {
      expect(group.applications.length).toBeGreaterThan(0);
    }
  });
});

describe("Status filters", () => {
  it("서류합격한 곳 selects everywhere past the documents", () => {
    const query = readQuery("서류합격한 곳 보여줘");
    expect(query).toEqual({
      kind: "status",
      label: "서류 통과",
      statuses: ["screening", "interview", "offer"],
    });

    const report = reportApplications(query!, KNOWLEDGE);
    const companies = report.groups.flatMap((g) => g.applications.map((a) => a.company));

    // 당근 is in screening; 배민, 네이버 and 쿠팡 got further, which still counts.
    expect(companies.sort()).toEqual(["네이버", "당근", "배민", "쿠팡"].sort());
    expect(companies).not.toContain("토스");
    expect(companies).not.toContain("카카오");
  });

  it("면접 예정인 곳 selects only interviews", () => {
    const query = readQuery("면접 예정인 곳 알려줘");
    expect(query).toMatchObject({ kind: "status", statuses: ["interview"] });

    const report = reportApplications(query!, KNOWLEDGE);
    const companies = report.groups.flatMap((g) => g.applications.map((a) => a.company));

    expect(companies.sort()).toEqual(["네이버", "배민"]);
    expect(report.summary).toContain("2건");
  });

  it("탈락한 곳 selects only rejections", () => {
    const query = readQuery("탈락한 곳 보여줘");
    const report = reportApplications(query!, KNOWLEDGE);
    const companies = report.groups.flatMap((g) => g.applications.map((a) => a.company));

    expect(companies).toEqual(["카카오"]);
  });

  it("says plainly when a filter matches nothing", () => {
    const withdrawnOnly = careerKnowledge(
      new InMemoryRepository(OWNER, [application("토스", "withdrawn")]),
      OWNER,
    );

    const report = reportApplications(readQuery("탈락한 곳")!, withdrawnOnly);

    expect(report.total).toBe(0);
    expect(report.empty).toBe(false);
    expect(report.summary).toContain("없습니다");
  });
});

describe("An empty record says so", () => {
  it("reports 기록된 지원 내역이 없습니다 rather than asking for a posting", () => {
    const report = reportApplications({ kind: "all" }, EMPTY);

    expect(report.empty).toBe(true);
    expect(report.summary).toBe("기록된 지원 내역이 없습니다.");
  });

  it("answers the seeded representative that way, since nothing is recorded yet", () => {
    const report = reportApplications({ kind: "all" }, careerKnowledgeFor(ACTOR));

    expect(report.empty).toBe(true);
    expect(report.summary).toBe("기록된 지원 내역이 없습니다.");
  });

  it("never mentions a posting in the answer", () => {
    const artifact = ask(freshLog(), "지금 지원현황 알려줘");
    const rendered = [artifact.title, ...artifact.sections.flatMap((s) => [s.heading, s.body])].join("\n");

    expect(rendered).toContain("기록된 지원 내역이 없습니다");
    for (const word of ["공고", "채용공고", "JD", "붙여"]) {
      expect(rendered).not.toContain(word);
    }
  });
});

describe("A list question is never answered with a question", () => {
  it("accepts without a company or a position", () => {
    for (const question of [
      "지금 지원현황 알려줘",
      "서류합격한 곳 보여줘",
      "면접 예정인 곳 알려줘",
      "탈락한 곳 보여줘",
    ]) {
      const log = freshLog();
      const result = operator.accept({ actor: ACTOR, log, subject: question, request: "", attachment: "" });

      expect(result).toEqual({ ok: true });
      // Nothing was asked back.
      expect(log.read().filter((e) => e.event.type === "AskRaised")).toHaveLength(0);
    }
  });

  it("raises no Ask at all", () => {
    const log = freshLog();
    ask(log, "지금 지원현황 알려줘");

    expect(log.read().some((e) => e.event.type === "AskRaised")).toBe(false);
  });

  it("refuses only when nothing was asked", () => {
    const log = freshLog();
    const result = operator.accept({ actor: ACTOR, log, subject: "", request: "", attachment: "" });

    expect(result.ok).toBe(false);
  });
});

describe("Routing", () => {
  const question = "지금 지원현황 알려줘";

  it("sends a status question to the Application Operator", () => {
    expect(route({ subject: question }).capability).toBe("career");
    expect(responsibilityForRequest("career", question)).toBe("career.application_operator");
  });

  it("sends each filter question to the operator too", () => {
    for (const q of ["서류합격한 곳 보여줘", "면접 예정인 곳 알려줘", "탈락한 곳 보여줘"]) {
      expect(responsibilityForRequest("career", q)).toBe("career.application_operator");
    }
  });

  it("still sends a posting to the Job Fit Analyst", () => {
    const posting = `Data Analyst

주요 업무
- SQL 을 사용해 사용자 행동 데이터를 분석합니다.
- Tableau 로 대시보드를 운영합니다.

자격 요건
- 데이터 분석 실무 경험 3년 이상
- 지원 자격: 학력 무관
- 지원 방법: 이메일 접수
`;

    // A posting says 지원 자격 and 지원 방법. Neither is a status question.
    expect(responsibilityForRequest("career", posting)).toBe("career.job_fit");
    expect(responsibilityForRequest("career", "토스 · Data Analyst")).toBe("career.job_fit");
  });

  it("keeps every other department on its accountable responsibility", () => {
    expect(responsibilityForRequest("home", "우유 다 썼어")).toBe("home.provisioning");
    expect(responsibilityForRequest("finance", "이번 달 지출 정리해줘")).toBe("finance.ledger-review");
  });

  it("declares its signals once, where the operator defines them", () => {
    expect(APPLICATION_QUERY_SIGNALS).toContain("지원현황");
    expect(APPLICATION_QUERY_SIGNALS).toContain("서류합격");
    expect(APPLICATION_QUERY_SIGNALS).toContain("탈락");
    // Nothing a posting would say.
    expect(APPLICATION_QUERY_SIGNALS).not.toContain("지원 자격");
    expect(APPLICATION_QUERY_SIGNALS).not.toContain("지원");
  });
});

describe("The operator only reports", () => {
  it("reads no posting and scores no fit", () => {
    const log = freshLog();
    ask(log, "지금 지원현황 알려줘");

    const rendered = JSON.stringify(log.read());

    expect(rendered).not.toContain("적합도");
    expect(rendered).not.toContain("fit_finding");
  });

  it("records no knowledge fact", () => {
    const log = freshLog();
    ask(log, "지금 지원현황 알려줘");

    expect(log.read().some((e) => e.event.type === "KnowledgeFactRecorded")).toBe(false);
  });

  it("declares the responsibility it executes", () => {
    expect(operator.responsibility).toBe("career.application_operator");
    // Operations only: it takes work and reports, and answers no question.
    expect(operator.answer).toBeUndefined();
    expect(operator.revise).toBeUndefined();
  });
});
