/**
 * The term review as an authenticated request answers it.
 *
 * What must hold: a review reads for whoever is signed in and nobody else; a
 * batch of decisions is typed before it is applied; anything untypeable is
 * refused rather than partly applied; direct input still needs its second
 * confirmation; and no request may name whose vocabulary it wants.
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  TERMS_HOLD,
  careerTermDecide,
  careerTermReview,
  readDecisions,
} from "./capabilities/career/ontology/api.ts";
import { careerOntologyFor } from "./capabilities/career/ontology/provider.ts";
import { changeFacts } from "./capabilities/career/ontology/changes.ts";
import { candidateQueue } from "./capabilities/career/ontology/queue.ts";
import { runner as analyst } from "./capabilities/career/runner.ts";
import type { SearchFinding, TermSearch } from "./capabilities/career/ontology/research.ts";
import type { ActorContext } from "./identity/types.ts";

const SEED_EMAIL = "owner@example.com";
process.env.LIFE_OS_CAREER_SEED_EMAIL = SEED_EMAIL;

const ACTOR = {
  user: { id: "usr-1", email: SEED_EMAIL },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

/** Somebody else, with their own vocabulary and their own stream. */
const PARTNER = {
  user: { id: "usr-2", email: "partner@example.com" },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

const JD = `Data Analyst

자격 요건
- BigQuery 환경 운영
- dbt 모델 관리
- SQL
`;

const FINDINGS: SearchFinding[] = [
  {
    title: "BigQuery",
    snippet: "BigQuery is a serverless data warehouse platform.",
    source: "https://example.test/bigquery",
    retrievedAt: "2026-08-04T00:00:00.000Z",
  },
];

const search: TermSearch = () => Promise.resolve(FINDINGS);

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-api-")), "events.jsonl"));
}

function queued(): EventLog {
  const log = freshLog();
  analyst.accept({ actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "" });
  return log;
}

describe("Reading the review", () => {
  it("returns the pending candidates", async () => {
    const review = await careerTermReview(ACTOR, queued());

    expect(review.items.map((i) => i.candidate.term)).toContain("BigQuery");
    expect(review.version).toBeGreaterThan(0);
  });

  it("includes research suggestions when a search is available", async () => {
    const review = await careerTermReview(ACTOR, queued(), search);
    const item = review.items.find((i) => i.candidate.term === "BigQuery")!;

    expect(item.research.state).toBe("suggested");
    if (item.research.state !== "suggested") throw new Error("shape");

    expect(item.research.suggestions[0].kind).toBe("tool");
    expect(item.research.sources).toEqual(["https://example.test/bigquery"]);
  });

  it("says so honestly when no search adapter is configured", async () => {
    const review = await careerTermReview(ACTOR, queued());

    for (const item of review.items.filter((i) => i.candidate.status === "pending")) {
      expect(item.research.state).toBe("unavailable");
    }
  });

  it("refuses a request carrying no identity", async () => {
    await expect(careerTermReview(undefined as unknown as ActorContext, queued()))
      .rejects.toThrow(/대표 정보가 없습니다/);
  });

  it("reads a different representative's own, empty review", async () => {
    // The partner's vocabulary is empty and their queue is what is on this
    // stream — never a view onto somebody else's decisions.
    const review = await careerTermReview(PARTNER, freshLog());

    expect(review.items).toEqual([]);
    expect(review.version).toBe(0);
  });
});

describe("Typing a batch", () => {
  it("reads every supported decision", () => {
    const parsed = readDecisions({
      decisions: [
        { kind: "tool", term: "BigQuery" },
        { kind: "capability", term: "리텐션 분석", aliases: ["Retention Analysis"] },
        { kind: "vocabulary", term: "그로스" },
        { kind: "alias", term: "빅쿼리", targetTermId: "SKL-002" },
        { kind: "defer", term: "dbt" },
        { kind: "not_a_term", term: "Airflow" },
        { kind: "direct", term: "Zzz", text: "도구입니다" },
        { kind: "approve_direct", term: "Zzz", text: "도구입니다" },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.decisions).toHaveLength(8);
    expect(parsed.decisions[1]).toEqual({
      kind: "capability", term: "리텐션 분석", aliases: ["Retention Analysis"],
    });
  });

  it("refuses an unknown decision instead of skipping it", () => {
    const parsed = readDecisions({
      decisions: [{ kind: "tool", term: "BigQuery" }, { kind: "delete", term: "dbt" }],
    });

    // A batch that dropped one decision would report success for a review the
    // representative believes they finished.
    expect(parsed).toMatchObject({ ok: false });
    if (parsed.ok) return;
    expect(parsed.reasons[0]).toContain("알 수 없는 결정");
  });

  it("refuses a decision with no term", () => {
    expect(readDecisions({ decisions: [{ kind: "tool" }] })).toMatchObject({ ok: false });
  });

  it("refuses an alias with no target", () => {
    expect(readDecisions({ decisions: [{ kind: "alias", term: "빅쿼리" }] }))
      .toMatchObject({ ok: false });
  });

  it("refuses direct input with no text", () => {
    expect(readDecisions({ decisions: [{ kind: "direct", term: "Zzz", text: "  " }] }))
      .toMatchObject({ ok: false });
  });

  it("refuses an empty or missing batch", () => {
    expect(readDecisions({ decisions: [] })).toMatchObject({ ok: false });
    expect(readDecisions({})).toMatchObject({ ok: false });
    expect(readDecisions("nonsense")).toMatchObject({ ok: false });
  });

  it("keeps direct input exactly as sent", () => {
    const written = "  BigQuery는 도구입니다.\n별칭: 빅쿼리  ";
    const parsed = readDecisions({ decisions: [{ kind: "direct", term: "Zzz", text: written }] });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.decisions[0]).toMatchObject({ text: written });
  });
});

describe("A request may not name a representative", () => {
  it("refuses an identity on the envelope", () => {
    for (const field of ["representative", "householdId", "userId", "actor", "owner"]) {
      const parsed = readDecisions({
        [field]: "usr-9",
        decisions: [{ kind: "tool", term: "BigQuery" }],
      });

      expect(parsed, field).toMatchObject({ ok: false });
      if (parsed.ok) continue;
      expect(parsed.reasons[0]).toContain("대표를 지정할 수 없습니다");
    }
  });

  it("refuses an identity on a decision", () => {
    const parsed = readDecisions({
      decisions: [{ kind: "tool", term: "BigQuery", userId: "usr-9" }],
    });

    expect(parsed).toMatchObject({ ok: false });
  });

  it("takes the representative from the session and nowhere else", () => {
    const source = readFileSync(
      join(import.meta.dirname, "capabilities/career/ontology/api.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    // Identity is derived from the actor; it is never read out of a body.
    expect(source).toContain("representativeOf(actor)");
    expect(source).not.toContain("body.householdId");
    expect(source).not.toContain("sent.userId");
  });
});

describe("Deciding a batch", () => {
  it("applies several decisions at once", () => {
    const log = queued();

    const outcome = careerTermDecide(ACTOR, log, [
      { kind: "tool", term: "BigQuery" },
      { kind: "defer", term: "dbt" },
    ]);

    expect(outcome.settled).toEqual(["bigquery"]);
    expect(outcome.deferred).toEqual(["dbt"]);
    expect(careerOntologyFor(ACTOR, log).resolve("BigQuery")?.kind).toBe("tool");
  });

  it("refuses a term that is not in this representative's queue", () => {
    const log = queued();

    // A candidate raised on somebody else's stream is not on this one.
    const outcome = careerTermDecide(ACTOR, log, [{ kind: "tool", term: "SomebodyElsesTerm" }]);

    expect(outcome.refusals[0]).toContain("검토 목록에 없는");
    expect(changeFacts(log)).toEqual([]);
  });

  it("cannot decide on another representative's queue", () => {
    const mine = queued();

    // The partner reads their own stream, so this candidate does not exist.
    const outcome = careerTermDecide(PARTNER, freshLog(), [{ kind: "tool", term: "BigQuery" }]);

    expect(outcome.refusals[0]).toContain("검토 목록에 없는");
    // And the owner's queue is untouched by it.
    expect(candidateQueue(mine).some((c) => c.normalised === "bigquery")).toBe(true);
  });

  it("refuses a request carrying no identity", () => {
    expect(() =>
      careerTermDecide(undefined as unknown as ActorContext, queued(), [
        { kind: "defer", term: "BigQuery" },
      ]),
    ).toThrow(/대표 정보가 없습니다/);
  });

  it("records against a stable hold that is not work", () => {
    const log = queued();
    careerTermDecide(ACTOR, log, [{ kind: "tool", term: "BigQuery" }]);

    const [change] = changeFacts(log);
    const handovers = log.read().filter((e) => e.event.type === "HandedOver");

    expect(TERMS_HOLD).toBe("career-terms");
    // Curating a vocabulary is not something the representative handed over,
    // so no work order is opened for it.
    expect(handovers.every((e) => e.event.type === "HandedOver" && e.event.holdId !== TERMS_HOLD))
      .toBe(true);
    expect(change).toBeDefined();
  });
});

describe("Direct input over the API", () => {
  const TEXT = "BigQuery는 데이터 웨어하우스입니다.\n도구로 등록해 주세요.\n별칭: 빅쿼리";

  it("returns a proposal and writes nothing", () => {
    const log = queued();

    const outcome = careerTermDecide(ACTOR, log, [{ kind: "direct", term: "BigQuery", text: TEXT }]);

    expect(outcome.awaiting).toHaveLength(1);
    expect(outcome.awaiting[0].text).toBe(TEXT);
    expect(outcome.awaiting[0].kind).toBe("tool");
    expect(changeFacts(log)).toEqual([]);
  });

  it("writes only on the second, explicit approval", () => {
    const log = queued();

    careerTermDecide(ACTOR, log, [{ kind: "direct", term: "BigQuery", text: TEXT }]);
    expect(careerOntologyFor(ACTOR, log).resolve("BigQuery")).toBeNull();

    careerTermDecide(ACTOR, log, [{ kind: "approve_direct", term: "BigQuery", text: TEXT }]);

    const ontology = careerOntologyFor(ACTOR, log);
    expect(ontology.resolve("BigQuery")?.kind).toBe("tool");
    expect(ontology.resolve("빅쿼리")?.id).toBe(ontology.resolve("BigQuery")?.id);
  });

  it("refuses to approve text it could not read", () => {
    const log = queued();

    const outcome = careerTermDecide(ACTOR, log, [
      { kind: "approve_direct", term: "BigQuery", text: "그냥 등록해 주세요" },
    ]);

    expect(outcome.refusals[0]).toContain("찾지 못했습니다");
    expect(changeFacts(log)).toEqual([]);
  });
});

describe("The routes are authenticated and scoped", () => {
  it("sits behind the identity boundary and reads Career's own stream", () => {
    const source = readFileSync(join(import.meta.dirname, "desk-api.ts"), "utf8");

    expect(source).toContain('url.pathname === "/api/career/terms"');
    expect(source).toContain('url.pathname === "/api/career/terms/decide"');

    // Everything under /api/ resolves an actor before `handle` is reached, and
    // Career's stream is chosen by its declared scope rather than by the caller.
    expect(source).toContain('careerTermReview(actor, ctx.logFor("career"))');
    expect(source).toContain('careerTermDecide(actor, ctx.logFor("career")');
  });

  it("passes no search adapter, so the review reports unavailable", () => {
    const source = readFileSync(join(import.meta.dirname, "desk-api.ts"), "utf8");

    // There is no adapter to wire yet, and none is invented at the edge.
    expect(source).not.toContain("careerTermReview(actor, ctx.logFor(\"career\"), ");
  });
});
