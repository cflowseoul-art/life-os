/**
 * The unknown term queue, as executable checks.
 *
 * What must hold: a term Career has no word for is noticed rather than lost;
 * one candidate per normalised term however many postings named it; nothing
 * enters the ontology; nobody is asked; an ignored term never returns; and the
 * fit report says only how many.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  detectUnknownTerms,
  postingId,
  projectCandidates,
} from "./capabilities/career/ontology/candidates.ts";
import type { TermCandidateFact } from "./capabilities/career/ontology/candidates.ts";
import { candidateFacts, candidateQueue, ignoredIn } from "./capabilities/career/ontology/queue.ts";
import { careerOntology, BootstrapOntologyRepository } from "./capabilities/career/ontology/index.ts";
import { SEEDED_ONTOLOGY } from "./capabilities/career/ontology/seed.ts";
import { analyseFit } from "./capabilities/career/job-fit.ts";
import { BootstrapRepository, careerKnowledge } from "./capabilities/career/knowledge/index.ts";
import { runner as analyst } from "./capabilities/career/runner.ts";
import type { RepresentativeKey } from "./capabilities/career/knowledge/index.ts";
import type { ActorContext } from "./identity/types.ts";

const OWNER: RepresentativeKey = { householdId: "hh-1", userId: "usr-1" };
const SEED_EMAIL = "owner@example.com";
process.env.LIFE_OS_CAREER_SEED_EMAIL = SEED_EMAIL;

const ACTOR = {
  user: { id: "usr-1", email: SEED_EMAIL },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

const ONTOLOGY = careerOntology(new BootstrapOntologyRepository(OWNER), OWNER);
const KNOWLEDGE = careerKnowledge(new BootstrapRepository(OWNER), OWNER);

const JD = `Data Analyst

주요 업무
- SQL 로 사용자 행동 데이터를 분석합니다.
- BigQuery 환경에서 파이프라인을 다룹니다.
- dbt 모델을 관리합니다.

자격 요건
- 실험 설계와 해석
- Tableau 대시보드 운영
`;

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-cand-")), "events.jsonl"));
}

function candidate(term: string, over: Partial<TermCandidateFact["value"]> = {}): TermCandidateFact {
  return {
    id: `c-${term}`,
    type: "term_candidate",
    value: {
      term,
      normalised: term.toLowerCase().replace(/\s/g, ""),
      locale: "en",
      sourceId: "src-1",
      sourceLabel: "회사 · 직무",
      status: "pending",
      ...over,
    },
    source: "posting:src-1",
    author: { kind: "external", name: "채용공고" },
    acquiredAt: "2026-08-01T00:00:00.000Z",
    confidence: 1,
  };
}

describe("Detection", () => {
  it("finds terms the vocabulary has no word for", () => {
    const found = detectUnknownTerms(JD, ONTOLOGY).map((t) => t.term);

    expect(found).toContain("BigQuery");
    expect(found).toContain("dbt");
  });

  it("leaves known terms alone", () => {
    const found = detectUnknownTerms(JD, ONTOLOGY).map((t) => t.term);

    expect(found).not.toContain("SQL");
    expect(found).not.toContain("Tableau");
  });

  it("reads requirement lines, not prose", () => {
    const prose = "우리는 BigQuery 를 씁니다.\n\n소개 문단입니다.";

    // Nothing is bulleted, so nothing is a stated requirement.
    expect(detectUnknownTerms(prose, ONTOLOGY)).toEqual([]);
  });

  it("does not queue a Korean sentence as a term", () => {
    const found = detectUnknownTerms(JD, ONTOLOGY).map((t) => t.term);

    for (const term of found) {
      expect(term).not.toContain("합니다");
    }
  });

  it("queues a Korean list item", () => {
    const found = detectUnknownTerms("- 실험 설계, 리텐션 분석", ONTOLOGY).map((t) => t.term);

    expect(found).toContain("실험 설계");
    expect(found).toContain("리텐션 분석");
  });

  it("records the locale it saw", () => {
    const found = detectUnknownTerms("- BigQuery\n- 리텐션 분석", ONTOLOGY);

    expect(found.find((t) => t.term === "BigQuery")?.locale).toBe("en");
    expect(found.find((t) => t.term === "리텐션 분석")?.locale).toBe("ko");
  });

  it("returns one entry per term however often a posting repeats it", () => {
    const repeated = "- BigQuery\n- BigQuery 경험\n- BigQuery 운영";

    expect(detectUnknownTerms(repeated, ONTOLOGY).filter((t) => t.term === "BigQuery"))
      .toHaveLength(1);
  });

  it("skips terms the representative ruled out", () => {
    const ignored = new Set(["bigquery"]);
    const found = detectUnknownTerms(JD, ONTOLOGY, ignored).map((t) => t.term);

    expect(found).not.toContain("BigQuery");
    expect(found).toContain("dbt");
  });
});

describe("The queue", () => {
  it("holds one candidate per normalised term", () => {
    const queue = projectCandidates([
      candidate("BigQuery"),
      candidate("bigquery", { sourceId: "src-2" }),
    ]);

    expect(queue).toHaveLength(1);
    expect(queue[0].occurrenceCount).toBe(2);
  });

  it("counts distinct postings, not sightings", () => {
    const queue = projectCandidates([
      candidate("BigQuery"),
      candidate("BigQuery"),
      candidate("BigQuery"),
    ]);

    // The same posting read three times is still one posting that said it.
    expect(queue[0].occurrenceCount).toBe(1);
  });

  it("records first seen, last seen, and every source", () => {
    const queue = projectCandidates([
      candidate("BigQuery"),
      { ...candidate("BigQuery", { sourceId: "src-2", sourceLabel: "다른 회사 · 직무" }),
        acquiredAt: "2026-08-05T00:00:00.000Z" },
    ]);

    expect(queue[0].firstSeen).toBe("2026-08-01T00:00:00.000Z");
    expect(queue[0].lastSeen).toBe("2026-08-05T00:00:00.000Z");
    expect(queue[0].sources.map((s) => s.sourceId)).toEqual(["src-1", "src-2"]);
  });

  it("keeps a deferred candidate in the queue", () => {
    const queue = projectCandidates([
      candidate("BigQuery"),
      candidate("BigQuery", { sourceId: "src-2", status: "deferred" }),
    ]);

    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("deferred");
  });

  it("drops an ignored candidate, permanently", () => {
    const facts = [candidate("BigQuery"), candidate("BigQuery", { sourceId: "s2", status: "ignored" })];

    expect(projectCandidates(facts)).toEqual([]);
    expect([...ignoredTermsOf(facts)]).toContain("bigquery");
  });

  function ignoredTermsOf(facts: TermCandidateFact[]): Set<string> {
    const log = freshLog();
    for (const fact of facts) {
      log.append({ type: "KnowledgeFactRecorded", holdId: "h", fact }, { kind: "system" }, "career", "t");
    }
    return ignoredIn(log);
  }
});

describe("Nothing is learned", () => {
  it("adds nothing to the ontology", () => {
    const before = ONTOLOGY.terms().length;
    const log = freshLog();

    analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });

    expect(ONTOLOGY.terms()).toHaveLength(before);
    expect(SEEDED_ONTOLOGY.terms.some((t) => t.id.includes("candidate"))).toBe(false);
    // A queued term still resolves to nothing.
    expect(ONTOLOGY.resolve("BigQuery")).toBeNull();
  });

  it("asks nothing", () => {
    const log = freshLog();
    analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });

    const asks = log.read().flatMap((e) => (e.event.type === "AskRaised" ? [e.event.ask] : []));

    // One Ask, and it is the apply/hold/skip decision — never about a word.
    expect(asks).toHaveLength(1);
    expect(asks[0].options.map((o) => o.id)).toEqual(["apply", "hold", "skip"]);
    expect(asks[0].question).not.toContain("BigQuery");
  });

  it("claims no meaning for what it queued", () => {
    const log = freshLog();
    analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });

    for (const fact of candidateFacts(log)) {
      expect(fact.value.status).toBe("pending");
      // The posting said the word. Nothing here says what it means.
      expect(fact.author).toEqual({ kind: "external", name: "채용공고" });
      expect(fact.source).toMatch(/^posting:/);
    }
  });
});

describe("Recording a sighting", () => {
  it("writes a candidate per unknown term in the posting", () => {
    const log = freshLog();
    analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });

    const queued = candidateQueue(log).map((c) => c.term);

    expect(queued).toContain("BigQuery");
    expect(queued).toContain("dbt");
    expect(queued).not.toContain("SQL");
  });

  it("does not double-count the same posting read twice", () => {
    const log = freshLog();
    const read = () =>
      analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });

    read();
    read();

    const bigquery = candidateQueue(log).find((c) => c.term === "BigQuery")!;
    expect(bigquery.occurrenceCount).toBe(1);
  });

  it("counts a term seen in a second posting", () => {
    const log = freshLog();

    analyst.accept({ actor: ACTOR, log, subject: "A · Data Analyst", request: "- BigQuery", attachment: "" });
    analyst.accept({ actor: ACTOR, log, subject: "B · Data Analyst", request: "- BigQuery", attachment: "" });

    const bigquery = candidateQueue(log).find((c) => c.term === "BigQuery")!;
    expect(bigquery.occurrenceCount).toBe(2);
    expect(bigquery.sources).toHaveLength(2);
  });

  it("gives the same posting the same id", () => {
    expect(postingId("A", "R", JD)).toBe(postingId("A", "R", JD));
    expect(postingId("A", "R", JD)).not.toBe(postingId("B", "R", JD));
  });
});

describe("Unknown terms reduce confidence", () => {
  it("lowers confidence without touching the fit percentage", () => {
    const withOntology = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, ONTOLOGY);
    const without = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE);

    // The score across what was recognised is unchanged.
    expect(withOntology.percent).toBe(without.percent);
    // But the reading now says how much of the posting it could read at all.
    expect(withOntology.unknown.length).toBeGreaterThan(0);
    expect(withOntology.confidence).toBeLessThan(1);
  });

  it("is fully confident when every requirement is recognised", () => {
    const known = "- SQL\n- Tableau\n- Python";
    const report = analyseFit({ company: "C", position: "R", posting: known }, KNOWLEDGE, ONTOLOGY);

    expect(report.unknown).toEqual([]);
    expect(report.confidence).toBe(1);
  });

  it("does not count a term already read as a match or a gap", () => {
    // AWS is a prohibited claim, so it is a gap — read, not unknown.
    const report = analyseFit(
      { company: "C", position: "R", posting: "- AWS\n- SQL" },
      KNOWLEDGE,
      ONTOLOGY,
    );

    expect(report.gaps.map((g) => g.requirement)).toContain("AWS");
    expect(report.unknown.map((u) => u.term)).not.toContain("AWS");
  });

  it("stays deterministic", () => {
    const a = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, ONTOLOGY);
    const b = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, ONTOLOGY);

    expect(b).toEqual(a);
  });
});

describe("The report says only how many", () => {
  it("shows a count and nothing else", () => {
    const log = freshLog();
    analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });

    const kept = log.read().filter((e) => e.event.type === "ArtifactKept");
    const last = kept[kept.length - 1];
    if (last?.event.type !== "ArtifactKept") throw new Error("no artifact");

    const rendered = last.event.artifact.sections.map((s) => `${s.heading} ${s.body}`).join("\n");
    const line = last.event.artifact.sections.find((s) => s.heading.startsWith("아직 모르는 표현"));

    expect(line?.heading).toMatch(/^아직 모르는 표현 \d+개$/);
    expect(line?.body).toBe("");
    // Never the terms themselves, and never a question about them.
    expect(rendered).not.toContain("BigQuery");
    expect(rendered).not.toContain("dbt");
  });

  it("omits the line when there is nothing unknown", () => {
    const log = freshLog();
    analyst.accept({
      actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: "- SQL\n- Tableau", attachment: "",
    });

    const kept = log.read().filter((e) => e.event.type === "ArtifactKept");
    const last = kept[kept.length - 1];
    if (last?.event.type !== "ArtifactKept") throw new Error("no artifact");

    expect(last.event.artifact.sections.some((s) => s.heading.startsWith("아직 모르는"))).toBe(false);
  });
});
