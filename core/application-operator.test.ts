/**
 * The Application Operator, as executable checks.
 *
 * What must hold: a question about the whole search is answered from the
 * record, never with a question back; each status filter selects what it says;
 * an empty record says it is empty rather than asking for a posting; and a
 * posting still reaches the Job Fit Analyst.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  APPLICATION_QUERY_SIGNALS,
  applicationFor,
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

describe("Natural language writes", () => {
  function fresh() {
    const log = freshLog();
    const say = (text: string) =>
      operator.accept({ actor: ACTOR, log, subject: text, request: "", attachment: "" });
    const knowledge = () => careerKnowledgeFor(ACTOR, log);
    return { log, say, knowledge };
  }

  it("creates an application from 지원 완료", () => {
    const { say, knowledge } = fresh();

    expect(say("채널톡 지원 완료")).toEqual({ ok: true });

    const record = applicationFor(knowledge(), "채널톡")!;
    expect(record.company).toBe("채널톡");
    expect(record.status).toBe("applied");
    expect(record.appliedAt).not.toBeNull();
    expect(record.history).toHaveLength(1);
  });

  it("updates an existing application and keeps what came before", () => {
    const { say, knowledge } = fresh();

    say("원프레딕트 지원 완료");
    say("원프레딕트 서류 합격");
    say("원프레딕트 1차 면접");
    say("원프레딕트 2차 면접");
    say("원프레딕트 최종 합격");

    const record = applicationFor(knowledge(), "원프레딕트")!;

    expect(record.status).toBe("offer");
    expect(record.history.map((h) => h.status)).toEqual([
      "applied", "screening", "interview", "interview", "offer",
    ]);
    // Nothing was overwritten: each movement is still exactly as recorded.
    expect(record.history.map((h) => h.interviewStage)).toEqual([null, null, 1, 2, null]);
  });

  it("reads the interview stage the representative named", () => {
    const { say, knowledge } = fresh();

    say("에이블리 지원 완료");
    say("에이블리 1차 면접");

    const record = applicationFor(knowledge(), "에이블리")!;
    expect(record.status).toBe("interview");
    expect(record.interviewStage).toBe(1);
  });

  it("records a rejection", () => {
    const { say, knowledge } = fresh();

    say("미리디 지원 완료");
    say("미리디 최종 탈락");

    expect(applicationFor(knowledge(), "미리디")!.status).toBe("rejected");
  });

  it("adds a memo without changing status", () => {
    const { say, knowledge } = fresh();

    say("채널톡 지원 완료");
    say("채널톡 메모 추가\n라이브 SQL 테스트 있음");

    const record = applicationFor(knowledge(), "채널톡")!;
    expect(record.memo).toBe("라이브 SQL 테스트 있음");
    expect(record.status).toBe("applied");
    expect(record.history).toHaveLength(2);
  });

  it("rejects a duplicate application", () => {
    const { say, knowledge } = fresh();

    say("채널톡 지원 완료");
    const again = say("채널톡 지원 완료");

    expect(again.ok).toBe(false);
    expect(again).toMatchObject({ reasons: [expect.stringContaining("이미")] });
    // The duplicate wrote nothing.
    expect(applicationFor(knowledge(), "채널톡")!.history).toHaveLength(1);
  });

  it("refuses to move an application nobody applied to", () => {
    const { say } = fresh();
    const result = say("몰라요 서류 합격");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reasons: [expect.stringContaining("지원한 기록이 없습니다")] });
  });

  it("refuses a command that names no company", () => {
    const { say } = fresh();
    const result = say("지원 취소");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reasons: [expect.stringContaining("어느 회사인지")] });
  });

  it("reports only what moved", () => {
    const { log, say } = fresh();

    say("채널톡 지원 완료");
    say("채널톡 서류 합격");

    const kept = log.read().filter((e) => e.event.type === "ArtifactKept");
    const last = kept[kept.length - 1];
    if (last?.event.type !== "ArtifactKept") throw new Error("no artifact");

    expect(last.event.artifact.sections.map((s) => s.heading)).toEqual([
      "회사 · 채널톡",
      "직무 · 미기재",
      "이전 상태 · 지원함",
      "현재 상태 · 서류 통과",
      "기록 2건",
    ]);
  });
});

describe("Queries reflect writes immediately", () => {
  it("shows a new application in the very next query", () => {
    const log = freshLog();
    const say = (text: string) =>
      operator.accept({ actor: ACTOR, log, subject: text, request: "", attachment: "" });

    expect(reportApplications({ kind: "all" }, careerKnowledgeFor(ACTOR, log)).empty).toBe(true);

    say("채널톡 지원 완료");
    say("당근 지원 완료");
    say("당근 서류 합격");

    const all = reportApplications({ kind: "all" }, careerKnowledgeFor(ACTOR, log));
    expect(all.total).toBe(2);

    const passed = reportApplications(readQuery("서류합격한 곳")!, careerKnowledgeFor(ACTOR, log));
    expect(passed.groups.flatMap((g) => g.applications.map((a) => a.company))).toEqual(["당근"]);
  });

  it("counts an application once however many movements it has", () => {
    const log = freshLog();
    const say = (text: string) =>
      operator.accept({ actor: ACTOR, log, subject: text, request: "", attachment: "" });

    say("토스 지원 완료");
    say("토스 서류 합격");
    say("토스 1차 면접");

    const all = reportApplications({ kind: "all" }, careerKnowledgeFor(ACTOR, log));

    expect(all.total).toBe(1);
    expect(all.groups.map((g) => g.status)).toEqual(["interview"]);
  });
});

describe("Only the operator writes application history", () => {
  it("routes an instruction to the operator", () => {
    for (const said of [
      "채널톡 지원 완료",
      "원프레딕트 서류 합격",
      "에이블리 1차 면접",
      "미리디 최종 탈락",
      "채널톡 메모 추가\n라이브 SQL 테스트 있음",
    ]) {
      expect(responsibilityForRequest("career", said)).toBe("career.application_operator");
    }
  });

  it("still sends a posting listing 1차 면접 to the Job Fit Analyst", () => {
    const posting = `Data Analyst

주요 업무
- SQL 을 사용해 사용자 행동 데이터를 분석합니다.
- Tableau 로 대시보드를 운영합니다.

전형 절차
- 서류 전형 → 1차 면접 → 2차 면접 → 최종 합격
- 지원 자격: 학력 무관
`;

    expect(responsibilityForRequest("career", posting)).toBe("career.job_fit");
  });

  it("is the only runner that writes an application fact", () => {
    for (const file of ["capabilities/career/runner.ts", "capabilities/career/job-fit.ts"]) {
      const source = readFileSync(join(import.meta.dirname, file), "utf8");
      expect(source, `${file} writes applications`).not.toContain('"application"');
    }
  });

  it("writes the movement as an event, so nothing is overwritten", () => {
    const log = freshLog();
    const say = (text: string) =>
      operator.accept({ actor: ACTOR, log, subject: text, request: "", attachment: "" });

    say("토스 지원 완료");
    say("토스 최종 탈락");

    const facts = log.read().flatMap((e) =>
      e.event.type === "KnowledgeFactRecorded" && e.event.fact.type === "application"
        ? [e.event.fact.value as { status: string }]
        : [],
    );

    // Two facts, both intact. The first still says 지원함.
    expect(facts.map((f) => f.status)).toEqual(["applied", "rejected"]);
  });
});
