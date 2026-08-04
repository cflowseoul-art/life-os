/**
 * The KnowledgeFact foundation, as executable checks.
 *
 * Two guarantees are load-bearing and easy to lose quietly:
 *   - a fact written before authorship existed stays *unattributed*, forever
 *   - the kernel never learns a department's vocabulary
 *
 * Both are tested by construction below rather than by reading the code.
 */

import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import { SCHEMA_VERSION } from "./events/types.ts";
import type { EventEnvelope, KnowledgeFact } from "./events/types.ts";
import { UNSTRUCTURED, upcast } from "./events/migrate.ts";
import { advanceHome, inventory } from "./company/home-runner.ts";
import { preferences, remember } from "./capabilities/home/memory.ts";
import { asHomeFact, display as displayHome } from "./capabilities/home/facts.ts";
import { asFinanceFact, INFERENCE_CONFIDENCE } from "./capabilities/finance/facts.ts";
import { projectWorkOrders } from "./company/work-order.ts";
import { templateFor } from "./reports/templates.ts";

function freshLog(): string {
  return join(mkdtempSync(join(tmpdir(), "lifeos-kf-")), "events.jsonl");
}

/** An event exactly as schema 1–2 wrote it. Hand-built; nothing constructs one. */
function legacyLine(holdId: string, statement: string, source = "receipt:3"): string {
  return `${JSON.stringify({
    id: "11111111-1111-4111-8111-111111111111",
    schemaVersion: 2,
    at: "2026-01-01T00:00:00.000Z",
    actor: { kind: "capability", id: "home" },
    capability: "home",
    source: "home",
    event: {
      type: "ObservationRecorded",
      holdId,
      observation: { id: "item-1", statement, source, acquiredAt: "2026-01-01T00:00:00.000Z", confidence: 1 },
    },
  })}\n`;
}

function handOverHome(log: EventLog, store: string, text: string): void {
  log.append(
    { type: "HandedOver", holdId: `hold-${store}`, capability: "home", handover: { company: store, role: "영수증", jdText: text } },
    { kind: "user" },
    "home",
    "test",
  );
}

describe("Legacy facts", () => {
  it("loads without data loss", () => {
    const path = freshLog();
    appendFileSync(path, legacyLine("h1", "서울우유 1L · 2개 · 6,000원"), "utf8");

    const [envelope] = new EventLog(path).read();

    expect(envelope.event.type).toBe("KnowledgeFactRecorded");
    if (envelope.event.type !== "KnowledgeFactRecorded") return;

    const fact = envelope.event.fact;

    // Every field that existed is preserved exactly, including the prose.
    expect(fact.id).toBe("item-1");
    expect(fact.type).toBe(UNSTRUCTURED);
    expect(fact.value).toBe("서울우유 1L · 2개 · 6,000원");
    expect(fact.source).toBe("receipt:3");
    expect(fact.acquiredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(fact.confidence).toBe(1);
  });

  it("leaves the author unattributed rather than inferring one", () => {
    const path = freshLog();
    appendFileSync(path, legacyLine("h1", "서울우유 1L · 2개 · 6,000원"), "utf8");

    const [envelope] = new EventLog(path).read();
    if (envelope.event.type !== "KnowledgeFactRecorded") throw new Error("shape");

    expect(envelope.event.fact.author).toEqual({ kind: "unattributed" });
    // The envelope's actor was available and was deliberately not borrowed.
    expect(envelope.actor).toEqual({ kind: "capability", id: "home" });
  });

  it("never rewrites the line on disk", () => {
    const path = freshLog();
    const original = legacyLine("h1", "서울우유 1L · 2개 · 6,000원");
    appendFileSync(path, original, "utf8");

    new EventLog(path).read();

    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("is idempotent — upcasting a current-shape event changes nothing", () => {
    const path = freshLog();
    handOverHome(new EventLog(path), "마트", "우유 1L 1개 3,000원");
    advanceHome(new EventLog(path));

    for (const envelope of new EventLog(path).read()) {
      expect(upcast(envelope)).toEqual(envelope);
    }
  });
});

describe("New typed facts", () => {
  it("preserve actor, author, source, confidence, and derivedFrom", () => {
    const path = freshLog();
    const log = new EventLog(path);

    const fact: KnowledgeFact = {
      id: "f1",
      type: "purchase",
      value: { name: "서울우유 1L", quantity: 2, unit: "개", amount: 6000 },
      source: "receipt:3",
      author: { kind: "representative", userId: "u1" },
      acquiredAt: "2026-01-01T00:00:00.000Z",
      confidence: 1,
      derivedFrom: ["f0"],
    };

    log.append({ type: "KnowledgeFactRecorded", holdId: "h1", fact }, { kind: "system" }, "home", "test");

    const [envelope] = new EventLog(path).read();
    if (envelope.event.type !== "KnowledgeFactRecorded") throw new Error("shape");

    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    // actor and author are different questions and both survive the round trip.
    expect(envelope.actor).toEqual({ kind: "system" });
    expect(envelope.event.fact.author).toEqual({ kind: "representative", userId: "u1" });
    expect(envelope.event.fact.source).toBe("receipt:3");
    expect(envelope.event.fact.confidence).toBe(1);
    expect(envelope.event.fact.derivedFrom).toEqual(["f0"]);
  });
});

describe("Home projections", () => {
  const RECEIPT = "서울우유 1L 2개 6,000원\n계란 30구 1개 7,000원";

  it("keeps inventory correct from typed facts", () => {
    const path = freshLog();
    handOverHome(new EventLog(path), "마트", RECEIPT);
    advanceHome(new EventLog(path));

    const stock = inventory(new EventLog(path).read());

    expect(stock.find((s) => s.name === "서울우유 1L")?.quantity).toBe(2);
    expect(stock.find((s) => s.name === "계란 30구")?.quantity).toBe(1);
  });

  it("keeps inventory correct from legacy prose facts", () => {
    const path = freshLog();
    appendFileSync(path, legacyLine("h1", "서울우유 1L · 2개 · 6,000원"), "utf8");
    appendFileSync(path, legacyLine("h1", "행사할인 · 할인 · -500원"), "utf8");

    const stock = inventory(new EventLog(path).read());

    expect(stock.find((s) => s.name === "서울우유 1L")?.quantity).toBe(2);
    // A discount is not stock, whichever shape it was recorded in.
    expect(stock.some((s) => s.name === "행사할인")).toBe(false);
  });

  it("records a stated preference and reads it back", () => {
    const path = freshLog();
    handOverHome(new EventLog(path), "말씀", "우유 다 썼어. 저지방으로 사줘");
    advanceHome(new EventLog(path));

    const events = new EventLog(path).read();

    expect(preferences(events).map((p) => p.about)).toContain("저지방");
    // The depletion is a fact too, and it is the representative's assertion.
    const depletion = events
      .flatMap((e) => (e.event.type === "KnowledgeFactRecorded" ? [e.event.fact] : []))
      .find((f) => f.type === "depletion");

    expect(depletion?.author).toEqual({ kind: "representative" });
  });

  it("reads preferences and depletions out of legacy prose", () => {
    const path = freshLog();
    appendFileSync(path, legacyLine("h1", "선호 · 저지방", "대표님 말씀"), "utf8");
    appendFileSync(path, legacyLine("h1", "우유 · 소진", "대표님 말씀"), "utf8");

    const events = new EventLog(path).read();

    expect(preferences(events).map((p) => p.about)).toContain("저지방");
    // A depletion clears the shelf, so memory must still see it.
    expect(remember(events).every((m) => m.name !== "우유")).toBe(true);
  });

  it("narrows a foreign department's fact to null rather than coercing it", () => {
    const foreign: KnowledgeFact = {
      id: "x",
      type: "jd_requirement",
      value: { statement: "SQL" },
      source: "handover.jdText:1",
      author: { kind: "external", name: "채용공고" },
      acquiredAt: "2026-01-01T00:00:00.000Z",
      confidence: 1,
    };

    expect(asHomeFact(foreign)).toBeNull();
  });
});

describe("Finance", () => {
  it("keeps the observation/inference distinction in typed facts", () => {
    const observed = asFinanceFact({
      id: "s1", type: "observation", value: { text: "구독료 초과" },
      source: "거래내역 3행", author: { kind: "external", name: "가계부" },
      acquiredAt: "2026-01-01T00:00:00.000Z", confidence: 1,
    });

    const inferred = asFinanceFact({
      id: "s2", type: "inference", value: { text: "평소보다 늘었습니다" },
      source: "거래내역 9행", author: { kind: "system" },
      acquiredAt: "2026-01-01T00:00:00.000Z", confidence: INFERENCE_CONFIDENCE,
    });

    expect(observed?.type).toBe("observation");
    expect(inferred?.type).toBe("inference");
    // An inference is never as strongly supported as a direct reading (§5).
    expect(INFERENCE_CONFIDENCE).toBeLessThan(1);
  });

  it("keeps the distinction when reading legacy bracket prose", () => {
    const base = {
      id: "s1", type: UNSTRUCTURED, source: "거래내역 3행",
      author: { kind: "unattributed" as const },
      acquiredAt: "2026-01-01T00:00:00.000Z", confidence: 1,
    };

    expect(asFinanceFact({ ...base, value: "[관찰] 구독료 초과" })?.type).toBe("observation");
    expect(asFinanceFact({ ...base, value: "[추론] 평소보다 늘었습니다" })?.type).toBe("inference");
    expect(asFinanceFact({ ...base, value: "가계부를 열지 못했습니다" })?.type).toBe("unavailable");
  });
});

describe("Work orders", () => {
  it("does not advance merely because a fact was recorded", () => {
    const path = freshLog();
    const log = new EventLog(path);

    log.append(
      { type: "HandedOver", holdId: "h1", capability: "home", handover: { company: "마트", role: "영수증", jdText: "x" } },
      { kind: "user" }, "home", "test",
    );

    const beforeState = projectWorkOrders(log.read())[0].state;

    log.append(
      {
        type: "KnowledgeFactRecorded",
        holdId: "h1",
        fact: {
          id: "f1", type: "purchase",
          value: { name: "우유", quantity: 1, unit: "개", amount: 3000 },
          source: "receipt:1", author: { kind: "external", name: "영수증" },
          acquiredAt: "2026-01-01T00:00:00.000Z", confidence: 1,
        },
      },
      { kind: "capability", id: "home" }, "home", "test",
    );

    const order = projectWorkOrders(log.read())[0];

    // Knowing something is not starting something.
    expect(beforeState).toBe("assigned");
    expect(order.state).toBe("assigned");
    expect(order.history.some((h) => h.state === "working")).toBe(false);
  });
});

describe("Layering", () => {
  it("keeps domain fact vocabulary out of the kernel", () => {
    const kernel = ["events/types.ts", "events/log.ts", "events/migrate.ts", "custody/engine.ts"]
      .map((f) => readFileSync(join(import.meta.dirname, f), "utf8"))
      .join("\n");

    // Department-owned type names. The kernel transports them and never names
    // them; a global domain enum here is the failure this test exists to catch.
    for (const vocabulary of [
      "jd_requirement", "purchase", "discount", "depletion", "preference", "inference",
    ]) {
      expect(kernel).not.toContain(`"${vocabulary}"`);
    }
  });

  it("hands the surface formatted text, never a fact type to switch on", () => {
    const fact: KnowledgeFact = {
      id: "f1", type: "purchase",
      value: { name: "서울우유 1L", quantity: 2, unit: "개", amount: 6000 },
      source: "receipt:3", author: { kind: "external", name: "영수증" },
      acquiredAt: "2026-01-01T00:00:00.000Z", confidence: 1,
    };

    // The department writes the line; the desk only asks for it.
    expect(templateFor("home").displayFact(fact)).toBe("서울우유 1L · 2개 · 6,000원");
    expect(displayHome(fact)).toBe("서울우유 1L · 2개 · 6,000원");

    const screen = readFileSync(
      join(import.meta.dirname, "../frontend/src/pages/RepresentativeComputer.tsx"),
      "utf8",
    );

    // No surface may branch on a department's vocabulary, or reach into a
    // fact's raw value. (`e.target.value` on a form input is unrelated.)
    for (const vocabulary of ["jd_requirement", "\"purchase\"", "\"depletion\"", "\"inference\""]) {
      expect(screen).not.toContain(vocabulary);
    }
    for (const reach of ["f.value", "fact.value", "f.type", "fact.type"]) {
      expect(screen).not.toContain(reach);
    }
  });
});
