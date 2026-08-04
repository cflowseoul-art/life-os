/**
 * The Constitution, as executable checks.
 *
 * Each test names the article it enforces. An article without a test here is an
 * article that survives only by good intentions.
 */

import { appendFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CustodyEngine, unbackedNumbers } from "./custody/engine.ts";
import { EventLog, EventLogCorrupt } from "./events/log.ts";
import { SCHEMA_VERSION } from "./events/types.ts";
import type { Artifact } from "./events/types.ts";

const JD = `Data Analyst

Responsibilities
- SQL
- Python
- Dashboard
`;

function freshLog(): string {
  return join(mkdtempSync(join(tmpdir(), "lifeos-")), "events.jsonl");
}

describe("Article 3 — Custody", () => {
  it("refuses an incomplete handover and records nothing", () => {
    const path = freshLog();
    const engine = new CustodyEngine(new EventLog(path));

    const result = engine.handOver({ company: "", role: "Analyst", jdText: JD });

    expect(result.ok).toBe(false);
    // Nothing was acknowledged, so nothing may exist on disk.
    expect(existsSync(path)).toBe(false);
  });

  it("held work survives a process boundary", () => {
    const path = freshLog();

    new CustodyEngine(new EventLog(path)).handOver({
      company: "OpenAI",
      role: "Data Analyst",
      jdText: JD,
    });

    // A completely new engine, as after a restart. No shared memory.
    const revived = new CustodyEngine(new EventLog(path));

    expect(revived.outstandingAsk()).not.toBeNull();
    expect(revived.ledger()[0].facts).toHaveLength(3);
  });
});

describe("Article 4 — The Ask", () => {
  it("carries everything needed to answer it", () => {
    const engine = new CustodyEngine(new EventLog(freshLog()));
    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });

    const ask = engine.outstandingAsk();

    expect(ask?.facts.length).toBeGreaterThan(0);
    expect(ask?.options).toHaveLength(2);
    // Options are named, never OK/Cancel.
    expect(ask?.options.every((o) => o.label.trim() !== "")).toBe(true);
  });

  it("holds a second Ask rather than presenting two", () => {
    const path = freshLog();
    const engine = new CustodyEngine(new EventLog(path));

    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });
    engine.handOver({ company: "Anthropic", role: "Data Analyst", jdText: JD });

    const asks = engine
      .ledger()
      .filter((hold) => hold.outstandingAsk !== null);

    expect(asks).toHaveLength(1);
  });

  it("refuses an answer that is not an offered option", () => {
    const engine = new CustodyEngine(new EventLog(freshLog()));
    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });

    expect(engine.answer("req-99").ok).toBe(false);
  });
});

describe("Article 9 — Trust", () => {
  it("rejects a proposal stating a number it cannot source", () => {
    const fabricated: Artifact = {
      id: "a",
      title: "강조 순서",
      sections: [
        { heading: "핵심 요건 7개를 찾았습니다", body: "", derivedFrom: [] },
      ],
    };

    // Three real observations exist, so 7 is unsourceable.
    const allowed = new Set([1, 2, 3]);

    expect(unbackedNumbers(fabricated, allowed)).toContain(7);
  });

  it("states only counts that are literally true", () => {
    const engine = new CustodyEngine(new EventLog(freshLog()));
    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });

    const ask = engine.outstandingAsk();
    const claim = ask?.facts.find((f) => f.includes("요건"));

    // Three bullets in the JD, so the Ask may say 3 and nothing else.
    expect(claim).toContain("3");
  });
});

describe("Article 10 — Provenance", () => {
  it("gives every fact a source, an author, and an acquisition time", () => {
    const engine = new CustodyEngine(new EventLog(freshLog()));
    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });

    for (const fact of engine.ledger()[0].facts) {
      expect(fact.source).toMatch(/^handover\.jdText:\d+$/);
      expect(fact.acquiredAt).not.toBe("");
      expect(fact.confidence).toBe(1);
      // Author is required, and is never the anonymous fallback for a fact the
      // company wrote itself. Only pre-migration facts may be unattributed.
      expect(fact.author.kind).toBeTruthy();
      expect(fact.author.kind).not.toBe("unattributed");
    }
  });

  it("keeps author separate from the actor that wrote the event", () => {
    const path = freshLog();
    new CustodyEngine(new EventLog(path)).handOver({
      company: "OpenAI", role: "Data Analyst", jdText: JD,
    });

    const recorded = new EventLog(path)
      .read()
      .filter((e) => e.event.type === "KnowledgeFactRecorded");

    expect(recorded.length).toBeGreaterThan(0);

    for (const envelope of recorded) {
      if (envelope.event.type !== "KnowledgeFactRecorded") continue;

      // The capability wrote the event; the posting asserts the requirement.
      expect(envelope.actor).toEqual({ kind: "capability", id: "career" });
      expect(envelope.event.fact.author).toEqual({ kind: "external", name: "채용공고" });
    }
  });
});

describe("Article 8 — Transparency", () => {
  it("traces every artifact section back to a recorded fact", () => {
    const engine = new CustodyEngine(new EventLog(freshLog()));
    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });
    engine.answer(engine.outstandingAsk()!.options[1].id);

    const hold = engine.ledger()[0];
    const known = new Set(hold.facts.map((f) => f.id));

    expect(hold.artifact).not.toBeNull();
    for (const section of hold.artifact!.sections) {
      expect(section.derivedFrom.every((id) => known.has(id))).toBe(true);
    }
  });
});

describe("Article 18 — Deletion", () => {
  it("withdraws by appending, leaving history intact", () => {
    const path = freshLog();
    const log = new EventLog(path);
    const engine = new CustodyEngine(log);

    const handed = engine.handOver({
      company: "OpenAI",
      role: "Data Analyst",
      jdText: JD,
    });

    const before = log.read().length;
    engine.withdraw(handed.ok ? handed.holdId : "", "지원하지 않기로 했습니다.");

    expect(log.read().length).toBe(before + 1);
    expect(engine.ledger()[0].state).toBe("withdrawn");
  });
});

describe("Article 14 — Durability", () => {
  it("stores events as self-describing JSON with no model needed to read them", () => {
    const path = freshLog();
    new CustodyEngine(new EventLog(path)).handOver({
      company: "OpenAI",
      role: "Data Analyst",
      jdText: JD,
    });

    for (const envelope of new EventLog(path).read()) {
      expect(typeof envelope.at).toBe("string");
      expect(envelope.event.type).toBeTruthy();
    }
  });
});

describe("Stability guarantees", () => {
  it("Art. 14 — every persisted event carries id, version, time, actor, source", () => {
    const path = freshLog();
    new CustodyEngine(new EventLog(path)).handOver({
      company: "OpenAI", role: "Data Analyst", jdText: JD,
    });

    for (const e of new EventLog(path).read()) {
      expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
      // The constant, not a literal: a bumped schema must not need a test edit.
      expect(e.schemaVersion).toBe(SCHEMA_VERSION);
      expect(Number.isNaN(Date.parse(e.at))).toBe(false);
      expect(e.actor.kind).toBeTruthy();
      expect(typeof e.source).toBe("string");
    }
  });

  it("replay is deterministic — same log, same final state", () => {
    const path = freshLog();
    const engine = new CustodyEngine(new EventLog(path));
    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });
    engine.answer(engine.outstandingAsk()!.options[1].id);

    const first = JSON.stringify(new CustodyEngine(new EventLog(path)).ledger());
    const second = JSON.stringify(new CustodyEngine(new EventLog(path)).ledger());

    expect(second).toBe(first);
  });

  it("Art. 3 — the same handover twice is one hold", () => {
    const path = freshLog();
    const engine = new CustodyEngine(new EventLog(path));
    const input = { company: "OpenAI", role: "Data Analyst", jdText: JD };

    const a = engine.handOver(input);
    const b = engine.handOver(input);

    expect(engine.ledger()).toHaveLength(1);
    expect(a.ok && b.ok && a.holdId === b.holdId).toBe(true);
    expect(b.ok && b.duplicate).toBe(true);
  });

  it("re-advancing cannot duplicate observations, asks, or artifacts", () => {
    const path = freshLog();
    const log = new EventLog(path);
    const engine = new CustodyEngine(log);
    const handed = engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });
    const holdId = handed.ok ? handed.holdId : "";

    engine.advance(holdId);
    engine.advance(holdId);
    engine.answer(engine.outstandingAsk()!.options[0].id);
    engine.advance(holdId);
    engine.advance(holdId);

    const counts = (t: string) =>
      log.read().filter((e) => e.event.type === t).length;

    expect(counts("KnowledgeFactRecorded")).toBe(3);
    expect(counts("AskRaised")).toBe(1);
    expect(counts("AskAnswered")).toBe(1);
    expect(counts("ArtifactKept")).toBe(1);
  });

  it("Art. 4 — Ask id and option ids are stable across restarts", () => {
    const path = freshLog();
    new CustodyEngine(new EventLog(path)).handOver({
      company: "OpenAI", role: "Data Analyst", jdText: JD,
    });

    const a = new CustodyEngine(new EventLog(path)).outstandingAsk()!;
    const b = new CustodyEngine(new EventLog(path)).outstandingAsk()!;

    expect(b.id).toBe(a.id);
    expect(b.options.map((o) => o.id)).toEqual(a.options.map((o) => o.id));
  });

  it("Art. 8 — a malformed line fails loudly and yields no partial state", () => {
    const path = freshLog();
    new CustodyEngine(new EventLog(path)).handOver({
      company: "OpenAI", role: "Data Analyst", jdText: JD,
    });

    appendFileSync(path, '{"id":"x","schemaVersion":1,\n', "utf8");

    expect(() => new EventLog(path).read()).toThrow(EventLogCorrupt);
    expect(() => new CustodyEngine(new EventLog(path)).ledger()).toThrow();
  });

  it("Art. 8 — a future schemaVersion is refused, not guessed at", () => {
    const path = freshLog();
    appendFileSync(
      path,
      `${JSON.stringify({ id: "x", schemaVersion: 99, at: new Date().toISOString(), actor: { kind: "user" }, capability: null, source: "t", event: { type: "HoldWithdrawn", holdId: "h", reason: "r" } })}\n`,
      "utf8",
    );

    expect(() => new EventLog(path).read()).toThrow(EventLogCorrupt);
  });

  it("the runner boundary is replaceable without touching the engine", () => {
    const path = freshLog();
    const deferred: (() => void)[] = [];
    const engine = new CustodyEngine(new EventLog(path), {
      run: (task) => { deferred.push(task); },
    });

    engine.handOver({ company: "OpenAI", role: "Data Analyst", jdText: JD });

    // Handover is durable; no work has advanced yet.
    expect(engine.ledger()[0].state).toBe("held");
    expect(engine.outstandingAsk()).toBeNull();

    deferred.forEach((task) => { task(); });
    expect(engine.outstandingAsk()).not.toBeNull();
  });
});
