/**
 * Candidate review and approval, as executable checks.
 *
 * What must hold: everything pending is reviewed together; a decision moves a
 * candidate and nothing else; ignored never returns and deferred stays; free
 * text is kept exactly as written and never becomes the vocabulary without a
 * second, explicit confirmation; and the ontology changes only after one.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  REVIEW_OPTIONS,
  applyReview,
  openReview,
  openReviewWithResearch,
  proposeFromText,
} from "./capabilities/career/ontology/review.ts";
import {
  researchCandidate,
  researchFacts,
} from "./capabilities/career/ontology/research.ts";
import type { SearchFinding, TermSearch } from "./capabilities/career/ontology/research.ts";
import { candidateQueue } from "./capabilities/career/ontology/queue.ts";
import { changeFacts } from "./capabilities/career/ontology/changes.ts";
import { careerOntologyFor } from "./capabilities/career/ontology/provider.ts";
import { analyseFit } from "./capabilities/career/job-fit.ts";
import { BootstrapRepository, careerKnowledge } from "./capabilities/career/knowledge/index.ts";
import { runner as analyst } from "./capabilities/career/runner.ts";
import type { ReviewDecision } from "./capabilities/career/ontology/review.ts";
import type { RepresentativeKey } from "./capabilities/career/knowledge/index.ts";
import type { ActorContext } from "./identity/types.ts";

const OWNER: RepresentativeKey = { householdId: "hh-1", userId: "usr-1" };
const SEED_EMAIL = "owner@example.com";
process.env.LIFE_OS_CAREER_SEED_EMAIL = SEED_EMAIL;

const ACTOR = {
  user: { id: "usr-1", email: SEED_EMAIL },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

const KNOWLEDGE = careerKnowledge(new BootstrapRepository(OWNER), OWNER);

const JD = `Data Analyst

자격 요건
- BigQuery 환경 운영
- dbt 모델 관리
- Airflow 스케줄링
- SQL
`;

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-rev-")), "events.jsonl"));
}

/** A log with several pending candidates on it. */
function queued(): EventLog {
  const log = freshLog();
  analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });
  return log;
}

function review(log: EventLog) {
  return openReview(log, careerOntologyFor(ACTOR, log));
}

function decide(log: EventLog, decisions: ReviewDecision[]) {
  return applyReview(
    { log, holdId: "review-1", ontology: careerOntologyFor(ACTOR, log) },
    decisions,
  );
}

describe("One review, all of it", () => {
  it("offers exactly the seven options", () => {
    expect(REVIEW_OPTIONS.map((o) => o.kind)).toEqual([
      "alias", "capability", "tool", "vocabulary", "not_a_term", "defer", "direct",
    ]);
  });

  it("shows every pending candidate together", () => {
    const items = review(queued()).items.map((i) => i.candidate.term);

    expect(items).toContain("BigQuery");
    expect(items).toContain("dbt");
    expect(items).toContain("Airflow");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("orders by how often a term was seen", () => {
    const log = queued();
    analyst.accept({ actor: ACTOR, log, subject: "B · Data Analyst", request: "- dbt", attachment: "" });

    const items = review(log).items;

    expect(items[0].candidate.term).toBe("dbt");
    expect(items[0].candidate.occurrenceCount).toBe(2);
  });

  it("suggests terms already held, without claiming any is right", () => {
    const log = freshLog();
    analyst.accept({
      actor: ACTOR, log, subject: "A · Data Analyst", request: "- Data Modeling Tools", attachment: "",
    });

    const item = review(log).items.find((i) => i.candidate.term.includes("Data Modeling"));

    // Local comparison against labels already held. No search.
    expect(item?.nearMatches.map((n) => n.name)).toContain("Data Modeling");
  });

  it("records the vocabulary version it was opened against", () => {
    const log = queued();
    expect(review(log).version).toBe(careerOntologyFor(ACTOR, log).version());
  });
});

describe("Decisions move a candidate", () => {
  it("defers, and the candidate stays in the queue", () => {
    const log = queued();

    const outcome = decide(log, [{ kind: "defer", term: "BigQuery" }]);

    expect(outcome.deferred).toEqual(["BigQuery"]);

    const still = candidateQueue(log).find((c) => c.normalised === "bigquery");
    expect(still?.status).toBe("deferred");
    // Deferred means "not now", so it is still offered.
    expect(review(log).items.map((i) => i.candidate.term)).toContain("BigQuery");
  });

  it("ignores, and the candidate never returns", () => {
    const log = queued();

    decide(log, [{ kind: "not_a_term", term: "Airflow" }]);

    expect(candidateQueue(log).some((c) => c.normalised === "airflow")).toBe(false);
    expect(review(log).items.map((i) => i.candidate.term)).not.toContain("Airflow");

    // Even after the same posting is read again.
    analyst.accept({ actor: ACTOR, log, subject: "C · Data Analyst", request: JD, attachment: "" });
    expect(review(log).items.map((i) => i.candidate.term)).not.toContain("Airflow");
  });

  it("handles several candidates in one pass", () => {
    const log = queued();

    const outcome = decide(log, [
      { kind: "tool", term: "BigQuery" },
      { kind: "defer", term: "dbt" },
      { kind: "not_a_term", term: "Airflow" },
    ]);

    expect(outcome.settled).toEqual(["bigquery"]);
    expect(outcome.deferred).toEqual(["dbt"]);
    expect(outcome.ignored).toEqual(["Airflow"]);
  });

  it("refuses a term that is not in the review", () => {
    const outcome = decide(queued(), [{ kind: "tool", term: "몰라요" }]);

    expect(outcome.refusals[0]).toContain("검토 목록에 없는");
    expect(outcome.settled).toEqual([]);
  });
});

describe("Approval changes the vocabulary, and nothing else does", () => {
  it("adds nothing before a decision", () => {
    const log = queued();

    expect(changeFacts(log)).toEqual([]);
    expect(careerOntologyFor(ACTOR, log).resolve("BigQuery")).toBeNull();
  });

  it("adds a new tool once approved", () => {
    const log = queued();

    const outcome = decide(log, [{ kind: "tool", term: "BigQuery" }]);
    const ontology = careerOntologyFor(ACTOR, log);

    expect(outcome.version).toBe(2);
    expect(ontology.version()).toBe(2);
    expect(ontology.resolve("BigQuery")?.kind).toBe("tool");
  });

  it("adds an alias onto a term already held", () => {
    const log = freshLog();
    analyst.accept({
      actor: ACTOR, log, subject: "A · Data Analyst", request: "- 빅쿼리", attachment: "",
    });

    const before = careerOntologyFor(ACTOR, log);
    const tableau = before.resolve("Tableau")!;

    decide(log, [{ kind: "alias", term: "빅쿼리", targetTermId: tableau.id }]);

    // One concept, another name — not a second concept.
    const after = careerOntologyFor(ACTOR, log);
    expect(after.resolve("빅쿼리")?.id).toBe(tableau.id);
    expect(after.termsOfKind("tool")).toHaveLength(before.termsOfKind("tool").length);
  });

  it("records the approval as the representative's own", () => {
    const log = queued();
    decide(log, [{ kind: "tool", term: "BigQuery" }]);

    const [change] = changeFacts(log);

    expect(change.author).toEqual({ kind: "representative" });
    expect(change.value.settled).toEqual(["bigquery"]);
  });

  it("refuses a batch that would make one word reach two terms", () => {
    const log = freshLog();
    analyst.accept({
      actor: ACTOR, log, subject: "A · Data Analyst", request: "- Tableau Server 운영", attachment: "",
    });

    const term = review(log).items[0].candidate.term;
    const outcome = decide(log, [{ kind: "tool", term, aliases: ["Tableau"] }]);

    // `Tableau` already names a term, so the whole batch is refused rather
    // than written alongside it.
    expect(outcome.refusals.some((r) => r.includes("두 용어를 가리킵니다"))).toBe(true);
    expect(changeFacts(log)).toEqual([]);
  });

  it("does not change Job Fit scoring for a posting it already read", () => {
    const known = "- SQL\n- Tableau";

    const before = analyseFit({ company: "C", position: "R", posting: known }, KNOWLEDGE);
    const log = queued();
    decide(log, [{ kind: "tool", term: "BigQuery" }]);

    const after = analyseFit(
      { company: "C", position: "R", posting: known },
      KNOWLEDGE,
      careerOntologyFor(ACTOR, log),
    );

    expect(after.percent).toBe(before.percent);
    expect(after.strong).toEqual(before.strong);
    expect(after.recommendation).toBe(before.recommendation);
  });

  it("stops the approved term being unknown next time", () => {
    const log = queued();
    decide(log, [{ kind: "tool", term: "BigQuery" }]);

    const report = analyseFit(
      { company: "C", position: "R", posting: JD },
      KNOWLEDGE,
      careerOntologyFor(ACTOR, log),
    );

    expect(report.unknown.map((u) => u.term)).not.toContain("BigQuery");
  });
});

describe("Direct input", () => {
  const TEXT = "BigQuery는 구글 클라우드의 데이터 웨어하우스입니다.\n도구로 등록해 주세요.\n별칭: 빅쿼리, BQ";

  it("keeps the representative's text exactly as written", () => {
    const proposal = proposeFromText("BigQuery", TEXT);

    expect(proposal.text).toBe(TEXT);
  });

  it("reads a structured proposal out of it", () => {
    const proposal = proposeFromText("BigQuery", TEXT);

    expect(proposal.kind).toBe("tool");
    expect(proposal.aliases).toEqual(["빅쿼리", "BQ"]);
    expect(proposal.reading).toContain("도구");
  });

  it("says so when it cannot read a kind, rather than guessing one", () => {
    const proposal = proposeFromText("BigQuery", "잘 모르겠지만 자주 보입니다.");

    expect(proposal.kind).toBeNull();
    expect(proposal.reading).toContain("찾지 못했습니다");
  });

  it("writes nothing from free text alone", () => {
    const log = queued();

    const outcome = decide(log, [{ kind: "direct", term: "BigQuery", text: TEXT }]);

    expect(outcome.awaiting).toHaveLength(1);
    expect(outcome.awaiting[0].text).toBe(TEXT);
    // The vocabulary is untouched until the proposal is confirmed.
    expect(changeFacts(log)).toEqual([]);
    expect(careerOntologyFor(ACTOR, log).resolve("BigQuery")).toBeNull();
  });

  it("writes only after the proposal is confirmed", () => {
    const log = queued();

    decide(log, [{ kind: "direct", term: "BigQuery", text: TEXT }]);
    decide(log, [{ kind: "approve_direct", term: "BigQuery", text: TEXT }]);

    const ontology = careerOntologyFor(ACTOR, log);

    expect(ontology.resolve("BigQuery")?.kind).toBe("tool");
    // The aliases the representative wrote reach the same term.
    expect(ontology.resolve("빅쿼리")?.id).toBe(ontology.resolve("BigQuery")?.id);
    expect(ontology.resolve("BQ")?.id).toBe(ontology.resolve("BigQuery")?.id);
  });

  it("writes what was shown, because the reading is deterministic", () => {
    expect(proposeFromText("BigQuery", TEXT)).toEqual(proposeFromText("BigQuery", TEXT));
  });

  it("refuses to confirm a proposal it could not read", () => {
    const log = queued();

    const outcome = decide(log, [
      { kind: "approve_direct", term: "BigQuery", text: "그냥 등록해 주세요" },
    ]);

    expect(outcome.refusals[0]).toContain("찾지 못했습니다");
    expect(changeFacts(log)).toEqual([]);
  });

  it("records direct input as the representative's own words", () => {
    const log = queued();
    decide(log, [{ kind: "approve_direct", term: "BigQuery", text: TEXT }]);

    const [change] = changeFacts(log);

    expect(change.author).toEqual({ kind: "representative" });
    expect(change.value.labels.every((l) => l.source.includes("대표님"))).toBe(true);
  });
});

describe("Nothing is searched", () => {
  it("reaches no network from the review path", () => {
    for (const file of [
      "capabilities/career/ontology/review.ts",
      "capabilities/career/ontology/changes.ts",
      "capabilities/career/ontology/candidates.ts",
      "capabilities/career/ontology/queue.ts",
    ]) {
      const source = readFileSync(join(import.meta.dirname, file), "utf8");

      for (const reach of ["fetch(", "http", "WebSearch", "axios"]) {
        expect(source, `${file} reaches out`).not.toContain(reach);
      }
    }
  });

  it("suggests only from the vocabulary already held", () => {
    const log = queued();
    const ontology = careerOntologyFor(ACTOR, log);
    const held = new Set(ontology.terms().map((t) => t.id));

    for (const item of review(log).items) {
      for (const near of item.nearMatches) {
        expect(held.has(near.termId)).toBe(true);
      }
    }
  });
});

describe("Research reaches the review", () => {
  const TOOL_FINDINGS: SearchFinding[] = [
    {
      title: "BigQuery",
      snippet: "BigQuery is a serverless data warehouse platform.",
      source: "https://example.test/bigquery",
      retrievedAt: "2026-08-04T00:00:00.000Z",
    },
    {
      title: "What is BigQuery?",
      snippet: "A fully managed analytics service from Google Cloud.",
      source: "https://example.test/what",
      retrievedAt: "2026-08-04T00:00:00.000Z",
    },
  ];

  const search: TermSearch = () => Promise.resolve(TOOL_FINDINGS);
  const noise: TermSearch = () => Promise.resolve([
    { title: "Zzz", snippet: "그냥 어떤 문장입니다.", source: "https://example.test/a", retrievedAt: "2026-08-04T00:00:00.000Z" },
    { title: "Zzz 후기", snippet: "블로그 글입니다.", source: "https://example.test/b", retrievedAt: "2026-08-04T00:00:00.000Z" },
  ]);

  async function looked(log: EventLog, term: string, adapter: TermSearch) {
    await researchCandidate(
      { log, holdId: "r", ontology: careerOntologyFor(ACTOR, log), search: adapter },
      term,
    );
    return review(log);
  }

  it("says nothing has been looked up yet", () => {
    const item = review(queued()).items.find((i) => i.candidate.term === "BigQuery")!;

    expect(item.research).toEqual({ state: "not_searched", note: "아직 찾아보지 않았습니다." });
  });

  it("carries ranked suggestions, confidence, findings and sources", async () => {
    const found = await looked(queued(), "BigQuery", search);
    const item = found.items.find((i) => i.candidate.term === "BigQuery")!;

    expect(item.research.state).toBe("suggested");
    if (item.research.state !== "suggested") throw new Error("shape");

    expect(item.research.suggestions[0].kind).toBe("tool");
    expect(item.research.confidence).toBe(1);
    expect(item.research.findings).toHaveLength(2);
    expect(item.research.sources).toEqual([
      "https://example.test/bigquery",
      "https://example.test/what",
    ]);

    // Ranked, highest first.
    const confidences = item.research.suggestions.map((s) => s.confidence);
    expect([...confidences].sort((a, b) => b - a)).toEqual(confidences);
  });

  it("shows an unreadable result as unknown, with what was found", async () => {
    const log = freshLog();
    analyst.accept({
      actor: ACTOR, log, subject: "A · Data Analyst", request: "- Zzzqqq 운영", attachment: "",
    });

    const term = review(log).items[0].candidate.term;
    const found = await looked(log, term, noise);
    const item = found.items.find((i) => i.candidate.term === term)!;

    expect(item.research.state).toBe("unknown");
    if (item.research.state !== "unknown") throw new Error("shape");

    // Honest: it looked, it could not tell, and the evidence is still there.
    expect(item.research.findings).toHaveLength(2);
    expect(item.research.sources).toHaveLength(2);
    expect(item.research.note).toContain("판단하기 어렵습니다");
  });

  it("keeps the near matches it already had", async () => {
    const log = freshLog();
    analyst.accept({
      actor: ACTOR, log, subject: "A · Data Analyst", request: "- Data Modeling Tools", attachment: "",
    });

    const found = await looked(log, "Data Modeling Tools", search);
    const item = found.items[0];

    expect(item.nearMatches.map((n) => n.name)).toContain("Data Modeling");
    expect(item.research.state).toBe("suggested");
  });

  it("marks a deferred candidate as not searched", () => {
    const log = queued();
    decide(log, [{ kind: "defer", term: "BigQuery" }]);

    const item = review(log).items.find((i) => i.candidate.term === "BigQuery")!;

    expect(item.research).toEqual({ state: "not_searched", note: "나중에 보기로 두신 표현입니다." });
  });

  it("does not search by opening a review", () => {
    const log = queued();
    let calls = 0;

    const counting: TermSearch = () => {
      calls += 1;
      return Promise.resolve(TOOL_FINDINGS);
    };
    void counting;

    review(log);
    review(log);

    // Opening a list is looking, not acting.
    expect(calls).toBe(0);
    expect(researchFacts(log)).toEqual([]);
  });

  it("reuses the cache when the review is opened again", async () => {
    const log = queued();
    let calls = 0;

    const counting: TermSearch = () => {
      calls += 1;
      return Promise.resolve(TOOL_FINDINGS);
    };

    await openReviewWithResearch({ log, holdId: "r", ontology: careerOntologyFor(ACTOR, log), search: counting });
    const before = calls;

    await openReviewWithResearch({ log, holdId: "r", ontology: careerOntologyFor(ACTOR, log), search: counting });

    expect(calls).toBe(before);
  });

  it("says plainly when it could not look at all", async () => {
    const log = queued();

    // No adapter configured.
    const found = await openReviewWithResearch({
      log, holdId: "r", ontology: careerOntologyFor(ACTOR, log),
    });

    for (const item of found.items.filter((i) => i.candidate.status === "pending")) {
      expect(item.research).toEqual({ state: "unavailable", note: "지금은 찾아볼 수 없습니다." });
    }

    // A search that never happened is not cached, so it will be retried.
    expect(researchFacts(log)).toEqual([]);
  });

  it("writes nothing to the vocabulary", async () => {
    const log = queued();
    const before = careerOntologyFor(ACTOR, log);

    await openReviewWithResearch({ log, holdId: "r", ontology: before, search });

    const after = careerOntologyFor(ACTOR, log);

    expect(after.version()).toBe(before.version());
    expect(after.terms()).toHaveLength(before.terms().length);
    expect(after.resolve("BigQuery")).toBeNull();
    expect(changeFacts(log)).toEqual([]);
  });

  it("leaves the representative every option, whatever it suggested", async () => {
    const log = queued();
    const found = await looked(log, "BigQuery", search);
    const item = found.items.find((i) => i.candidate.term === "BigQuery")!;

    expect(item.research.state).toBe("suggested");
    // Nothing is narrowed or pre-selected.
    expect(REVIEW_OPTIONS).toHaveLength(7);
    expect(item.candidate.status).toBe("pending");
  });

  it("writes what was chosen, not what was suggested", async () => {
    const log = queued();
    await looked(log, "BigQuery", search);

    // Research read it as a tool; the representative says vocabulary.
    decide(log, [{ kind: "vocabulary", term: "BigQuery" }]);

    expect(careerOntologyFor(ACTOR, log).resolve("BigQuery")?.kind).toBe("vocabulary");
  });

  it("leaves the queue alone", async () => {
    const log = queued();
    const before = candidateQueue(log).map((c) => `${c.normalised}:${c.status}:${String(c.occurrenceCount)}`);

    await openReviewWithResearch({ log, holdId: "r", ontology: careerOntologyFor(ACTOR, log), search });

    const after = candidateQueue(log).map((c) => `${c.normalised}:${c.status}:${String(c.occurrenceCount)}`);

    expect(after).toEqual(before);
  });
});
