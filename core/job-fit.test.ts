/**
 * The Job Fit Analyst, as executable checks.
 *
 * What must hold: the same posting always produces the same report; the score
 * comes from typed knowledge rather than from words the posting happens to
 * share; what Career lacks is a gap; and the analyst evaluates without writing
 * anything.
 */

import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import { analyseFit, monthsOf, yearsRequired } from "./capabilities/career/job-fit.ts";
import {
  BootstrapRepository,
  InMemoryRepository,
  careerKnowledge,
} from "./capabilities/career/knowledge/index.ts";
import { useKnowledgeResolver } from "./capabilities/career/knowledge/provider.ts";
import { runner as analyst } from "./capabilities/career/runner.ts";
import type { RepresentativeKey } from "./capabilities/career/knowledge/index.ts";
import type { ActorContext } from "./identity/types.ts";

const OWNER: RepresentativeKey = { householdId: "hh-1", userId: "usr-1" };
const ACTOR = { user: { id: "usr-1" }, household: { id: "hh-1" } } as ActorContext;

const KNOWLEDGE = careerKnowledge(new BootstrapRepository(OWNER), OWNER);

/**
 * A posting of realistic length that asks for things the representative has.
 *
 * Length matters to one test below: a report carrying a score, its arithmetic
 * and its findings cannot be shorter than a four-line posting, and pretending
 * otherwise would mean testing against a posting nobody writes.
 */
const STRONG_JD = `Data Analyst (Product Analytics)

우리는 빠르게 성장하는 제품 조직에서 데이터로 의사결정을 이끌 분석가를 찾고 있습니다.
사용자 행동을 이해하고, 지표를 정의하고, 실험을 통해 제품 방향을 제안하는 역할입니다.

주요 업무
- SQL 을 사용해 대규모 사용자 행동 데이터를 추출하고 가공합니다.
- Tableau 로 팀별 대시보드를 설계하고 운영합니다.
- Python 기반으로 분석과 모델링을 수행합니다.
- A/B Test 를 설계하고 결과를 해석해 출시 여부를 제안합니다.
- 제품팀, 마케팅팀과 협업하여 지표 정의를 합의합니다.

자격 요건
- 데이터 분석 실무 경험
- 통계적 사고와 실험 설계에 대한 이해
- 비즈니스 맥락에서 문제를 정의해 본 경험

우대 사항
- 모바일 제품 분석 경험
- 데이터 품질 관리 경험
`;

/** A posting requiring something the record forbids claiming. */
const FORBIDDEN_JD = `Analytics Engineer

- AWS 환경 운영 경험 필수
- Hex 를 이용한 분석 경험
- SQL
`;

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-fit-")), "events.jsonl"));
}

function run(log: EventLog, posting: string): void {
  const restore = useKnowledgeResolver(() => new BootstrapRepository(OWNER));
  try {
    analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: posting, attachment: "" });
  } finally {
    useKnowledgeResolver(restore);
  }
}

function artifactOf(log: EventLog) {
  const kept = log.read().filter((e) => e.event.type === "ArtifactKept");
  const last = kept[kept.length - 1];
  if (last?.event.type !== "ArtifactKept") throw new Error("no artifact");
  return last.event.artifact;
}

describe("The same posting always produces the same result", () => {
  it("is deterministic across repeated analyses", () => {
    const a = analyseFit({ company: "OpenAI", position: "Data Analyst", posting: STRONG_JD }, KNOWLEDGE);
    const b = analyseFit({ company: "OpenAI", position: "Data Analyst", posting: STRONG_JD }, KNOWLEDGE);

    expect(b).toEqual(a);
  });

  it("does not depend on the order terms appear in the posting", () => {
    const forward = analyseFit(
      { company: "C", position: "R", posting: "- SQL\n- Tableau\n- Python" },
      KNOWLEDGE,
    );
    const reversed = analyseFit(
      { company: "C", position: "R", posting: "- Python\n- Tableau\n- SQL" },
      KNOWLEDGE,
    );

    // Iteration is over knowledge, so the posting cannot reorder the report.
    expect(reversed.strong.map((m) => m.requirement)).toEqual(forward.strong.map((m) => m.requirement));
    expect(reversed.percent).toBe(forward.percent);
  });
});

describe("Fit comes from typed knowledge", () => {
  it("grades a match by recorded evidence, not by how often a word appears", () => {
    const once = analyseFit({ company: "C", position: "R", posting: "SQL" }, KNOWLEDGE);
    const many = analyseFit(
      { company: "C", position: "R", posting: "SQL SQL SQL SQL SQL SQL" },
      KNOWLEDGE,
    );

    expect(many.percent).toBe(once.percent);
    expect(many.strong).toEqual(once.strong);
  });

  it("calls a skill strong only when two or more experiences evidence it", () => {
    const report = analyseFit({ company: "C", position: "R", posting: "Tableau, Databricks" }, KNOWLEDGE);

    // Tableau is evidenced by one experience; Databricks by three.
    expect(report.partial.map((m) => m.requirement)).toContain("Tableau");
    expect(report.strong.map((m) => m.requirement)).toContain("Databricks");
  });

  it("traces every finding back to the knowledge behind it", () => {
    const report = analyseFit({ company: "C", position: "R", posting: STRONG_JD }, KNOWLEDGE);
    const known = new Set(KNOWLEDGE.facts().map((f) => f.id));

    for (const match of [...report.strong, ...report.partial]) {
      expect(match.derivedFrom.length).toBeGreaterThan(0);
      expect(known.has(match.derivedFrom[0])).toBe(true);
    }
  });

  it("states the arithmetic behind the percentage", () => {
    const report = analyseFit({ company: "C", position: "R", posting: STRONG_JD }, KNOWLEDGE);
    const total = report.strong.length + report.partial.length + report.gaps.length;

    expect(report.formula).toContain(String(total));
    expect(report.percent).toBe(
      Math.round(((report.strong.length + report.partial.length * 0.5) / total) * 100),
    );
  });

  it("cannot score against knowledge that holds nothing", () => {
    const empty = careerKnowledge(new InMemoryRepository(OWNER), OWNER);
    const report = analyseFit({ company: "C", position: "R", posting: STRONG_JD }, empty);

    // Nothing recognised is not the same finding as nothing matched.
    expect(report.percent).toBeNull();
    expect(report.recommendation).toBe("Hold");
  });
});

describe("Missing knowledge becomes a gap", () => {
  it("makes a forbidden claim a gap, never a match", () => {
    const report = analyseFit({ company: "C", position: "R", posting: FORBIDDEN_JD }, KNOWLEDGE);
    const gaps = report.gaps.map((g) => g.requirement);

    expect(gaps).toContain("AWS");
    expect(gaps).toContain("Hex");
    expect(report.strong.map((m) => m.requirement)).not.toContain("AWS");
    expect(report.partial.map((m) => m.requirement)).not.toContain("AWS");
  });

  it("never recommends Apply on top of something that cannot be claimed", () => {
    const report = analyseFit({ company: "C", position: "R", posting: FORBIDDEN_JD }, KNOWLEDGE);

    expect(report.recommendation).not.toBe("Apply");
    expect(report.risks.length).toBeGreaterThan(0);
  });

  it("raises experience length as a risk when the posting states one", () => {
    const report = analyseFit(
      { company: "C", position: "R", posting: "- 5년 이상 경력\n- SQL" },
      KNOWLEDGE,
    );

    expect(report.risks.map((r) => r.statement).join(" ")).toContain("5년");
    expect(yearsRequired("- 5년 이상 경력")).toBe(5);
    expect(monthsOf("2025.03–2026.02")).toBe(12);
  });
});

describe("Recommendation is one of three", () => {
  it("recommends Apply when the record supports most of the posting", () => {
    const report = analyseFit({ company: "C", position: "R", posting: STRONG_JD }, KNOWLEDGE);

    expect(report.recommendation).toBe("Apply");
    expect(report.percent).toBeGreaterThanOrEqual(70);
  });

  it("recommends Skip when little is supported and something is forbidden", () => {
    const report = analyseFit(
      { company: "C", position: "R", posting: "- AWS\n- Hex\n- 대규모 분산처리" },
      KNOWLEDGE,
    );

    expect(report.recommendation).toBe("Skip");
  });

  it("never returns anything outside Apply, Hold, Skip", () => {
    for (const posting of [STRONG_JD, FORBIDDEN_JD, "", "- SQL", "무관한 내용"]) {
      const report = analyseFit({ company: "C", position: "R", posting }, KNOWLEDGE);
      expect(["Apply", "Hold", "Skip"]).toContain(report.recommendation);
    }
  });
});

describe("The report is a report", () => {
  it("is shorter than the posting it read", () => {
    const log = freshLog();
    run(log, STRONG_JD);

    const artifact = artifactOf(log);
    const rendered = [
      artifact.title,
      ...artifact.sections.flatMap((s) => [s.heading, s.body]),
    ].join("\n");

    expect(rendered.length).toBeLessThan(STRONG_JD.length);
    expect(artifact.sections.length).toBeLessThanOrEqual(12);
  });

  it("never pastes a line of the posting back", () => {
    const log = freshLog();
    run(log, STRONG_JD);

    const artifact = artifactOf(log);
    const rendered = [
      artifact.title,
      ...artifact.sections.flatMap((s) => [s.heading, s.body]),
    ].join("\n");

    const lines = STRONG_JD.split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      // The role itself came from the subject line, not from the posting body.
      .filter((l) => l.length > 8 && !l.startsWith("Data Analyst"));

    for (const line of lines) {
      expect(rendered, `pasted: ${line}`).not.toContain(line);
    }
  });

  it("names each requirement once", () => {
    const log = freshLog();
    run(log, STRONG_JD);

    const headings = artifactOf(log).sections.map((s) => s.heading);

    expect(new Set(headings).size).toBe(headings.length);
  });
});

describe("The analyst only evaluates", () => {
  it("writes no document and edits nothing", () => {
    const source = readFileSync(
      join(import.meta.dirname, "capabilities/career/runner.ts"),
      "utf8",
    );

    // No résumé, no portfolio, no cover letter — those are other employees'.
    expect(source).not.toContain("초안");
    expect(source).not.toContain("proposeArtifact");
    expect(source).not.toContain("resume_editor");
    expect(source).not.toContain("application_strategy");
  });

  it("asks exactly one question, and it is the representative's decision", () => {
    const log = freshLog();
    run(log, STRONG_JD);

    const asks = log.read().flatMap((e) => (e.event.type === "AskRaised" ? [e.event.ask] : []));

    expect(asks).toHaveLength(1);
    expect(asks[0].options.map((o) => o.id)).toEqual(["apply", "hold", "skip"]);
  });

  it("does not modify Career Knowledge", () => {
    const before = KNOWLEDGE.facts().length;
    const log = freshLog();
    run(log, STRONG_JD);

    expect(KNOWLEDGE.facts()).toHaveLength(before);
    // Nothing it recorded is a knowledge fact; findings belong to the hold.
    const recorded = log.read().flatMap((e) =>
      e.event.type === "KnowledgeFactRecorded" ? [e.event.fact.type] : [],
    );
    expect(new Set(recorded)).toEqual(new Set(["fit_finding"]));
  });

  it("stops after the decision instead of starting the next stage", () => {
    const log = freshLog();
    run(log, STRONG_JD);

    const ask = log.read().flatMap((e) => (e.event.type === "AskRaised" ? [e.event.ask] : []))[0];
    analyst.answer?.({ actor: ACTOR, log, ask, optionId: "apply" });

    // No second question, and no work handed to an employee who does not run.
    const asks = log.read().filter((e) => e.event.type === "AskRaised");
    expect(asks).toHaveLength(1);
    expect(artifactOf(log).sections[0].body).toContain("담당자가 배정되지 않았습니다");
  });

  it("reports plainly when Career holds no knowledge for the representative", () => {
    const log = freshLog();
    const restore = useKnowledgeResolver(() => null);

    try {
      analyst.accept({
        actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: STRONG_JD, attachment: "",
      });
    } finally {
      useKnowledgeResolver(restore);
    }

    expect(artifactOf(log).title).toContain("판단 불가");
    // No score was invented from an empty record.
    expect(artifactOf(log).sections.some((s) => /\d+%/.test(s.heading))).toBe(false);
  });
});

describe("Comparison is not word counting", () => {
  it("leaves no token-overlap analyser in the codebase", () => {
    function sources(dir: string): string[] {
      return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return sources(path);
        return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
      });
    }

    const career = sources(join(import.meta.dirname, "capabilities/career"));

    for (const path of career) {
      const code = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // The old analyser tokenised two texts and counted what they shared.
      expect(code, `${path} tokenises text`).not.toContain("NOISE");
      expect(code, `${path} reads a pasted profile`).not.toContain("readProfile");
    }
  });
});
