/**
 * The Career Ontology store, as executable checks.
 *
 * What must hold: one concept answers to all of its names; no name reaches two
 * concepts; the vocabulary is one representative's and refuses anybody else;
 * a version is available; and Job Fit reads exactly as it did before.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  BootstrapOntologyRepository,
  InMemoryOntologyRepository,
  careerOntology,
  emptyOntology,
  normaliseLabel,
  ontologyProblems,
} from "./capabilities/career/ontology/index.ts";
import { careerOntologyFor } from "./capabilities/career/ontology/provider.ts";
import { SEEDED_ONTOLOGY, SEEDED_VERSION } from "./capabilities/career/ontology/seed.ts";
import {
  BootstrapRepository,
  careerKnowledge,
} from "./capabilities/career/knowledge/index.ts";
import { analyseFit } from "./capabilities/career/job-fit.ts";
import { runner as analyst } from "./capabilities/career/runner.ts";
import type { Label, OntologySnapshot, Term } from "./capabilities/career/ontology/index.ts";
import type { RepresentativeKey } from "./capabilities/career/knowledge/index.ts";
import type { ActorContext } from "./identity/types.ts";

const OWNER: RepresentativeKey = { householdId: "hh-1", userId: "usr-1" };
const OTHER: RepresentativeKey = { householdId: "hh-2", userId: "usr-2" };

const SEED_EMAIL = "owner@example.com";
process.env.LIFE_OS_CAREER_SEED_EMAIL = SEED_EMAIL;

const ACTOR = {
  user: { id: "usr-1", email: SEED_EMAIL },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

const PARTNER = {
  user: { id: "usr-2", email: "partner@example.com" },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

const ONTOLOGY = careerOntology(new BootstrapOntologyRepository(OWNER), OWNER);
const KNOWLEDGE = careerKnowledge(new BootstrapRepository(OWNER), OWNER);

function term(id: string, over: Partial<Term> = {}): Term {
  return { id, kind: "tool", status: "active", mergedInto: null, since: 1, until: null, ...over };
}

function label(termId: string, text: string, over: Partial<Label> = {}): Label {
  return { termId, text, locale: "und", role: "canonical", source: "test", ...over };
}

function snapshot(over: Partial<OntologySnapshot> = {}): OntologySnapshot {
  return { version: 1, terms: [], labels: [], relations: [], ...over };
}

describe("A term answers to all of its names", () => {
  it("resolves the canonical label", () => {
    expect(ONTOLOGY.resolve("Data Modeling")?.id).toBe("SKL-013");
    expect(ONTOLOGY.resolve("Tableau")?.id).toBe("SKL-002");
  });

  it("resolves a Korean label to the same term as the English one", () => {
    // One concept, two names, held once.
    expect(ONTOLOGY.resolve("데이터 모델링")?.id).toBe("SKL-013");
    expect(ONTOLOGY.resolve("데이터 모델링")).toEqual(ONTOLOGY.resolve("Data Modeling"));
  });

  it("resolves an abbreviation", () => {
    expect(ONTOLOGY.resolve("Welch")?.id).toBe("SKL-010");
    expect(ONTOLOGY.resolve("Welch's t-test")?.id).toBe("SKL-010");
  });

  it("ignores case and separators", () => {
    for (const written of ["A/B Test", "a/b test", "AB Test", "ab-test"]) {
      expect(ONTOLOGY.resolve(written)?.id, written).toBe("SKL-011");
    }
  });

  it("returns nothing for a word it does not hold", () => {
    expect(ONTOLOGY.resolve("Hex")).toBeNull();
    expect(ONTOLOGY.resolve("")).toBeNull();
  });

  it("names a term in the locale asked for", () => {
    expect(ONTOLOGY.nameOf("SKL-013", "ko")).toBe("데이터 모델링");
    expect(ONTOLOGY.nameOf("SKL-013", "en")).toBe("Data Modeling");
    expect(ONTOLOGY.labelsOf("SKL-013")).toHaveLength(2);
  });
});

describe("No concept is duplicated across labels", () => {
  it("accepts the seeded vocabulary", () => {
    expect(ontologyProblems(SEEDED_ONTOLOGY)).toEqual([]);
  });

  it("refuses one label reaching two terms", () => {
    const problems = ontologyProblems(snapshot({
      terms: [term("T-1"), term("T-2")],
      labels: [label("T-1", "Data Modeling"), label("T-2", "data modeling")],
    }));

    // Different spellings, same normalised name: two concepts, one word.
    expect(problems).toContainEqual(expect.stringContaining("두 용어를 가리킵니다"));
  });

  it("refuses two canonical labels in one locale", () => {
    expect(ontologyProblems(snapshot({
      terms: [term("T-1")],
      labels: [label("T-1", "SQL"), label("T-1", "Structured Query Language")],
    }))).toContainEqual(expect.stringContaining("대표 라벨이 둘"));
  });

  it("refuses a term nobody can name", () => {
    expect(ontologyProblems(snapshot({ terms: [term("T-1")] })))
      .toContainEqual(expect.stringContaining("대표 라벨이 없습니다"));
  });

  it("refuses a label pointing at no term, and a relation to none", () => {
    expect(ontologyProblems(snapshot({ labels: [label("T-ghost", "x")] })))
      .toContainEqual(expect.stringContaining("없는 용어를 가리킵니다"));

    expect(ontologyProblems(snapshot({
      terms: [term("T-1")],
      labels: [label("T-1", "SQL")],
      relations: [{ from: "T-1", to: "T-ghost", kind: "supports" }],
    }))).toContainEqual(expect.stringContaining("관계의 대상 용어가 없습니다"));
  });

  it("refuses to construct a provider over a broken vocabulary", () => {
    expect(() => new InMemoryOntologyRepository(OWNER, {
      terms: [term("T-1"), term("T-2")],
      labels: [label("T-1", "SQL"), label("T-2", "sql")],
    })).toThrow(/올바르지 않습니다/);
  });
});

describe("The vocabulary belongs to one representative", () => {
  it("refuses to serve anybody else", () => {
    const repository = new BootstrapOntologyRepository(OWNER);

    expect(() => repository.snapshot(OTHER)).toThrow(/드릴 수 없습니다/);
  });

  it("gives the seeded representative the seeded vocabulary", () => {
    expect(careerOntologyFor(ACTOR).termsOfKind("tool")).toHaveLength(13);
  });

  it("gives everybody else an empty one", () => {
    const theirs = careerOntologyFor(PARTNER);

    expect(theirs.terms()).toEqual([]);
    expect(theirs.resolve("SQL")).toBeNull();
    expect(theirs.version()).toBe(0);
  });

  it("fails explicitly without an identity", () => {
    expect(() => careerOntologyFor(undefined as unknown as ActorContext)).toThrow();
  });
});

describe("A version is available", () => {
  it("reports the seeded version", () => {
    expect(ONTOLOGY.version()).toBe(SEEDED_VERSION);
    expect(SEEDED_VERSION).toBeGreaterThan(0);
  });

  it("is recorded on every reading made against it", () => {
    const report = analyseFit(
      { company: "C", position: "R", posting: "- SQL" },
      KNOWLEDGE,
      ONTOLOGY,
    );

    expect(report.ontologyVersion).toBe(SEEDED_VERSION);
  });

  it("records zero when no vocabulary was used", () => {
    const report = analyseFit({ company: "C", position: "R", posting: "- SQL" }, KNOWLEDGE);

    expect(report.ontologyVersion).toBe(0);
  });
});

describe("Tools only, for now", () => {
  it("holds no capability and no vocabulary term", () => {
    // ADR-025 makes capability the primary unit. Assigning one here would be
    // deciding on the representative's behalf what their work demonstrates.
    expect(ONTOLOGY.termsOfKind("capability")).toEqual([]);
    expect(ONTOLOGY.termsOfKind("vocabulary")).toEqual([]);
    expect(SEEDED_ONTOLOGY.relations).toEqual([]);
  });

  it("has one term per verified skill, under the id it was verified as", () => {
    const skills = KNOWLEDGE.factsOfType("skill");
    const tools = ONTOLOGY.termsOfKind("tool");

    expect(tools.map((t) => t.id).sort()).toEqual(skills.map((s) => s.id).sort());

    // The canonical name is what the record already called it, exactly.
    for (const skill of skills) {
      expect(ONTOLOGY.nameOf(skill.id)).toBe(skill.value.name);
    }
  });
});

describe("Job Fit reads as it did before", () => {
  const JD = `Data Analyst

- SQL 로 데이터를 다룹니다.
- Tableau 대시보드 운영
- Python 기반 분석
- A/B Test 설계
`;

  it("produces the same report with and without the vocabulary", () => {
    const without = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE);
    const with_ = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, ONTOLOGY);

    // Canonical labels are the skill names, so nothing that matched stops
    // matching and nothing new appears for a posting written in English.
    expect(with_.strong).toEqual(without.strong);
    expect(with_.partial).toEqual(without.partial);
    expect(with_.gaps).toEqual(without.gaps);
    expect(with_.percent).toBe(without.percent);
    expect(with_.recommendation).toBe(without.recommendation);
  });

  it("adds only what an alias makes reachable", () => {
    const korean = "- 데이터 모델링 경험";

    const without = analyseFit({ company: "C", position: "R", posting: korean }, KNOWLEDGE);
    const with_ = analyseFit({ company: "C", position: "R", posting: korean }, KNOWLEDGE, ONTOLOGY);

    // The English name is absent, so the old path finds nothing.
    expect(without.percent).toBeNull();
    // The Korean label reaches the same tool.
    expect(with_.partial.map((m) => m.requirement)).toContain("Data Modeling");
  });

  it("still matches when the representative has no vocabulary", () => {
    const empty = emptyOntology(OWNER);

    const report = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, empty);
    const fallback = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE);

    expect(report.strong).toEqual(fallback.strong);
  });

  it("stays deterministic", () => {
    const a = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, ONTOLOGY);
    const b = analyseFit({ company: "C", position: "R", posting: JD }, KNOWLEDGE, ONTOLOGY);

    expect(b).toEqual(a);
  });

  it("runs end to end through the analyst", () => {
    const log = new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-ont-")), "events.jsonl"));

    expect(analyst.accept({
      actor: ACTOR, log, subject: "OpenAI · Data Analyst", request: JD, attachment: "",
    })).toEqual({ ok: true });

    const kept = log.read().filter((e) => e.event.type === "ArtifactKept");
    const last = kept[kept.length - 1];
    if (last?.event.type !== "ArtifactKept") throw new Error("no artifact");

    expect(last.event.artifact.title).toMatch(/적합도 \d+%/);
  });
});

describe("Merged terms redirect", () => {
  it("resolves a merged term to what replaced it", () => {
    const merged = careerOntology(
      new InMemoryOntologyRepository(OWNER, {
        terms: [term("T-1", { status: "merged", mergedInto: "T-2" }), term("T-2")],
        labels: [label("T-1", "Old Name"), label("T-2", "New Name")],
      }),
      OWNER,
    );

    // Evidence still pointing at the old id keeps resolving.
    expect(merged.resolve("Old Name")?.id).toBe("T-2");
    expect(merged.byId("T-1")?.id).toBe("T-2");
  });

  it("does not loop on a cycle", () => {
    const looped = careerOntology(
      new InMemoryOntologyRepository(OWNER, {
        terms: [
          term("T-1", { status: "merged", mergedInto: "T-2" }),
          term("T-2", { status: "merged", mergedInto: "T-1" }),
        ],
        labels: [label("T-1", "A"), label("T-2", "B")],
      }),
      OWNER,
    );

    expect(looped.byId("T-1")).toBeNull();
  });

  it("leaves a deprecated term resolvable but unmatched", () => {
    const aged = careerOntology(
      new InMemoryOntologyRepository(OWNER, {
        terms: [term("T-1", { status: "deprecated" })],
        labels: [label("T-1", "Old Tool")],
      }),
      OWNER,
    );

    expect(aged.resolve("Old Tool")?.id).toBe("T-1");
    expect(aged.mentionedIn("we use Old Tool here")).toEqual(new Set());
  });
});

describe("Normalisation is shared", () => {
  it("is the same rule for lookup and for the duplicate check", () => {
    expect(normaliseLabel("A/B Test")).toBe(normaliseLabel("ab test"));
    expect(normaliseLabel("Welch's t-test")).toBe("welchsttest");
  });

  it("will not let a one-character label match everything", () => {
    const tiny = careerOntology(
      new InMemoryOntologyRepository(OWNER, {
        terms: [term("T-1")],
        labels: [label("T-1", "R")],
      }),
      OWNER,
    );

    expect(tiny.mentionedIn("우리는 좋은 분석가를 찾습니다")).toEqual(new Set());
  });
});
