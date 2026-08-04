/**
 * Search-assisted suggestions, as executable checks.
 *
 * What must hold: only pending candidates are looked up; a lookup happens once
 * and is reused; nothing reaches the vocabulary; suggestions are ranked and
 * carry the evidence behind them; and a weak reading is reported as unknown
 * rather than stated.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  MIN_CONFIDENCE,
  SearchFoundNothing,
  SearchUnavailable,
  cachedResearch,
  rankSuggestions,
  researchCandidate,
  researchFacts,
  unavailableSearch,
} from "./capabilities/career/ontology/research.ts";
import type { SearchFinding, TermSearch } from "./capabilities/career/ontology/research.ts";
import { careerOntologyFor } from "./capabilities/career/ontology/provider.ts";
import { changeFacts } from "./capabilities/career/ontology/changes.ts";
import { applyReview } from "./capabilities/career/ontology/review.ts";
import { candidateQueue } from "./capabilities/career/ontology/queue.ts";
import { runner as analyst } from "./capabilities/career/runner.ts";
import type { ActorContext } from "./identity/types.ts";

const SEED_EMAIL = "owner@example.com";
process.env.LIFE_OS_CAREER_SEED_EMAIL = SEED_EMAIL;

const ACTOR = {
  user: { id: "usr-1", email: SEED_EMAIL },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

const JD = `Data Analyst

자격 요건
- BigQuery 환경 운영
- dbt 모델 관리
- SQL
`;

function finding(title: string, snippet: string): SearchFinding {
  return { title, snippet, source: "https://example.test/x", retrievedAt: "2026-08-04T00:00:00.000Z" };
}

const TOOL_FINDINGS = [
  finding("BigQuery", "BigQuery is a serverless data warehouse platform."),
  finding("What is BigQuery?", "A fully managed analytics service from Google Cloud."),
];

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-res-")), "events.jsonl"));
}

/** A log carrying pending candidates. */
function queued(): EventLog {
  const log = freshLog();
  analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });
  return log;
}

/** A search that records how many times it was called. */
function countingSearch(findings: SearchFinding[]): TermSearch & { calls: number } {
  const search = (() => {
    search.calls += 1;
    return Promise.resolve(findings);
  }) as TermSearch & { calls: number };

  search.calls = 0;
  return search;
}

function look(log: EventLog, term: string, search: TermSearch, refresh = false) {
  return researchCandidate(
    { log, holdId: "research-1", ontology: careerOntologyFor(ACTOR, log), search },
    term,
    { refresh },
  );
}

describe("Only pending candidates are searched", () => {
  it("looks up a pending candidate", async () => {
    const log = queued();
    const outcome = await look(log, "BigQuery", countingSearch(TOOL_FINDINGS));

    expect(outcome.ok).toBe(true);
  });

  it("refuses a term nobody queued", async () => {
    const outcome = await look(queued(), "몰라요", countingSearch(TOOL_FINDINGS));

    expect(outcome).toMatchObject({ ok: false, reason: expect.stringContaining("검토 목록에 없는") });
  });

  it("refuses a deferred candidate", async () => {
    const log = queued();

    applyReview(
      { log, holdId: "r", ontology: careerOntologyFor(ACTOR, log) },
      [{ kind: "defer", term: "BigQuery" }],
    );

    expect(candidateQueue(log).find((c) => c.normalised === "bigquery")?.status).toBe("deferred");

    const outcome = await look(log, "BigQuery", countingSearch(TOOL_FINDINGS));
    expect(outcome).toMatchObject({ ok: false, reason: expect.stringContaining("볼 차례가 아닙니다") });
  });

  it("refuses an ignored candidate, which is no longer in the queue", async () => {
    const log = queued();

    applyReview(
      { log, holdId: "r", ontology: careerOntologyFor(ACTOR, log) },
      [{ kind: "not_a_term", term: "dbt" }],
    );

    const outcome = await look(log, "dbt", countingSearch(TOOL_FINDINGS));
    expect(outcome.ok).toBe(false);
  });
});

describe("Ranked suggestions with confidence", () => {
  it("reads a tool out of findings that describe one", () => {
    const log = queued();
    const suggestions = rankSuggestions("BigQuery", TOOL_FINDINGS, careerOntologyFor(ACTOR, log));

    expect(suggestions[0].kind).toBe("tool");
    expect(suggestions[0].confidence).toBe(1);
  });

  it("ranks highest confidence first", () => {
    const mixed = [
      finding("BigQuery", "a data warehouse platform"),
      finding("BigQuery", "a data warehouse platform"),
      finding("BigQuery analysis", "used for analysis of large datasets"),
    ];

    const suggestions = rankSuggestions("BigQuery", mixed, careerOntologyFor(ACTOR, queued()));
    const confidences = suggestions.map((s) => s.confidence);

    expect([...confidences].sort((a, b) => b - a)).toEqual(confidences);
  });

  it("carries the findings behind each suggestion", () => {
    const suggestions = rankSuggestions("BigQuery", TOOL_FINDINGS, careerOntologyFor(ACTOR, queued()));

    expect(suggestions[0].evidence).toHaveLength(2);
    for (const evidence of suggestions[0].evidence) {
      expect(evidence.source).toMatch(/^https?:/);
      expect(evidence.retrievedAt).not.toBe("");
    }
  });

  it("offers a term the vocabulary already holds, without searching for it", () => {
    const suggestions = rankSuggestions("Tableau", [], careerOntologyFor(ACTOR, queued()));

    expect(suggestions[0].kind).toBe("existing_term");
    expect(suggestions[0].targetTermId).toBe("SKL-002");
    expect(suggestions[0].evidence).toEqual([]);
  });

  it("offers an alias when a held label is close", () => {
    const suggestions = rankSuggestions(
      "Data Modeling Tools",
      [],
      careerOntologyFor(ACTOR, queued()),
    );

    const alias = suggestions.find((s) => s.kind === "alias");
    expect(alias?.targetTermId).toBe("SKL-013");
  });

  it("is deterministic", () => {
    const ontology = careerOntologyFor(ACTOR, queued());

    expect(rankSuggestions("BigQuery", TOOL_FINDINGS, ontology))
      .toEqual(rankSuggestions("BigQuery", TOOL_FINDINGS, ontology));
  });
});

describe("A weak reading is Unknown", () => {
  it("returns unknown when nothing was found", () => {
    const suggestions = rankSuggestions("Zzzz", [], careerOntologyFor(ACTOR, queued()));

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].kind).toBe("unknown");
    expect(suggestions[0].rationale).toContain("찾지 못했습니다");
  });

  it("returns unknown when the findings say nothing useful", () => {
    const noise = [
      finding("Zzzz", "그냥 어떤 문장입니다."),
      finding("Zzzz 후기", "블로그 글입니다."),
    ];

    const suggestions = rankSuggestions("Zzzz", noise, careerOntologyFor(ACTOR, queued()));

    expect(suggestions[0].kind).toBe("unknown");
    // The findings are still carried, so the representative can see them.
    expect(suggestions[0].evidence).toHaveLength(2);
  });

  it("drops a reading below the stated threshold", () => {
    // One of four findings supports "tool" — 0.25, under the threshold.
    const weak = [
      finding("Zzzz", "a tool for something"),
      finding("Zzzz", "관련 없는 문장"),
      finding("Zzzz", "관련 없는 문장"),
      finding("Zzzz", "관련 없는 문장"),
    ];

    const suggestions = rankSuggestions("Zzzz", weak, careerOntologyFor(ACTOR, queued()));

    expect(MIN_CONFIDENCE).toBe(0.5);
    expect(suggestions[0].kind).toBe("unknown");
  });

  it("keeps a reading at the threshold", () => {
    const even = [
      finding("Zzzz", "a tool for something"),
      finding("Zzzz", "관련 없는 문장"),
    ];

    expect(rankSuggestions("Zzzz", even, careerOntologyFor(ACTOR, queued()))[0].kind).toBe("tool");
  });
});

describe("A candidate is searched once", () => {
  it("reuses the cached result", async () => {
    const log = queued();
    const search = countingSearch(TOOL_FINDINGS);

    const first = await look(log, "BigQuery", search);
    const second = await look(log, "BigQuery", search);

    expect(search.calls).toBe(1);
    expect(first).toMatchObject({ ok: true, cached: false });
    expect(second).toMatchObject({ ok: true, cached: true });
  });

  it("returns the same suggestions from cache", async () => {
    const log = queued();
    const search = countingSearch(TOOL_FINDINGS);

    const first = await look(log, "BigQuery", search);
    const second = await look(log, "BigQuery", search);

    expect(first.ok && second.ok && second.research.suggestions)
      .toEqual(first.ok ? first.research.suggestions : null);
  });

  it("searches again only when asked to refresh", async () => {
    const log = queued();
    const search = countingSearch(TOOL_FINDINGS);

    await look(log, "BigQuery", search);
    const refreshed = await look(log, "BigQuery", search, true);

    expect(search.calls).toBe(2);
    expect(refreshed).toMatchObject({ ok: true, cached: false });
    expect(researchFacts(log)).toHaveLength(2);
  });

  it("caches each candidate separately", async () => {
    const log = queued();
    const search = countingSearch(TOOL_FINDINGS);

    await look(log, "BigQuery", search);
    await look(log, "dbt", search);
    await look(log, "BigQuery", search);

    expect(search.calls).toBe(2);
    expect(cachedResearch(log, "BigQuery")?.term).toBe("BigQuery");
    expect(cachedResearch(log, "dbt")?.term).toBe("dbt");
  });

  it("has nothing cached before the first look", () => {
    expect(cachedResearch(queued(), "BigQuery")).toBeNull();
  });
});

describe("A search that never happened is not cached", () => {
  it("caches nothing when no adapter is configured", async () => {
    const log = queued();

    const outcome = await researchCandidate(
      { log, holdId: "r", ontology: careerOntologyFor(ACTOR, log) },
      "BigQuery",
    );

    expect(outcome).toMatchObject({ ok: false, reason: expect.stringContaining("찾아볼 수 없습니다") });
    // Caching "unavailable" would make a missing adapter a settled answer.
    expect(researchFacts(log)).toEqual([]);
    expect(cachedResearch(log, "BigQuery")).toBeNull();
  });

  it("refuses by default rather than returning an empty result", async () => {
    await expect(unavailableSearch("x")).rejects.toThrow(SearchUnavailable);
  });

  it("caches nothing when the search found nothing", async () => {
    const log = queued();
    const failing: TermSearch = () => Promise.reject(new SearchFoundNothing("BigQuery"));

    const outcome = await look(log, "BigQuery", failing);

    expect(outcome).toMatchObject({ ok: false });
    expect(researchFacts(log)).toEqual([]);
  });
});

describe("Nothing is written to the vocabulary", () => {
  it("leaves the ontology untouched", async () => {
    const log = queued();
    const before = careerOntologyFor(ACTOR, log);
    const count = before.terms().length;

    await look(log, "BigQuery", countingSearch(TOOL_FINDINGS));

    const after = careerOntologyFor(ACTOR, log);

    expect(after.terms()).toHaveLength(count);
    expect(after.version()).toBe(before.version());
    expect(after.resolve("BigQuery")).toBeNull();
    expect(changeFacts(log)).toEqual([]);
  });

  it("records the search as the system looking, not as a claim", async () => {
    const log = queued();
    await look(log, "BigQuery", countingSearch(TOOL_FINDINGS));

    const [fact] = researchFacts(log);

    // Research looked. It does not assert what the word means.
    expect(fact.author).toEqual({ kind: "system" });
    expect(fact.source).toBe("research");
  });

  it("leaves the candidate pending", async () => {
    const log = queued();
    await look(log, "BigQuery", countingSearch(TOOL_FINDINGS));

    expect(candidateQueue(log).find((c) => c.normalised === "bigquery")?.status).toBe("pending");
  });

  it("still lets an approval change the vocabulary afterwards", async () => {
    const log = queued();
    await look(log, "BigQuery", countingSearch(TOOL_FINDINGS));

    applyReview(
      { log, holdId: "r", ontology: careerOntologyFor(ACTOR, log) },
      [{ kind: "tool", term: "BigQuery" }],
    );

    expect(careerOntologyFor(ACTOR, log).resolve("BigQuery")?.kind).toBe("tool");
  });
});

describe("The search is a seam", () => {
  it("imports no search SDK into domain code", () => {
    const source = readFileSync(
      join(import.meta.dirname, "capabilities/career/ontology/research.ts"),
      "utf8",
    );

    for (const reach of ["fetch(", "axios", "node:https", "googleapis", "WebSearch"]) {
      expect(source, `research.ts reaches out directly`).not.toContain(reach);
    }
  });
});
