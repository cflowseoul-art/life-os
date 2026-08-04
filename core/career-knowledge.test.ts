/**
 * Career Knowledge, as executable checks.
 *
 * Three properties matter and each is easy to lose quietly:
 *
 *   - Career already knows this, so no employee may ask for it again
 *   - what Career does not know is *stated*, not absent
 *   - nothing in the store was invented in transcription
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_CATEGORIES,
  byId,
  coverage,
  display,
  factsIn,
  factsOfType,
  gaps,
  gapsIn,
  isKnowledgeFact,
  knowledge,
  owns,
  prohibitions,
} from "./capabilities/career/knowledge/index.ts";
import { display as displayCareerFact } from "./capabilities/career/facts.ts";
import { employeeForResponsibility } from "./company/employees.ts";
import type { ResponsibilityId } from "./company/responsibilities.ts";

/** Every Career employee, by the responsibility they own. */
const CAREER_EMPLOYEES: ResponsibilityId[] = [
  "career.job_fit",
  "career.application_strategy",
  "career.resume_editor",
  "career.portfolio_editor",
  "career.cover_letter",
  "career.interview_coach",
  "career.application_operator",
];

describe("Career loads the representative's knowledge", () => {
  it("holds the seeded career history, projects, achievements, and skills", () => {
    expect(factsOfType("employment")).toHaveLength(1);
    expect(factsOfType("experience")).toHaveLength(5);
    expect(factsOfType("project")).toHaveLength(1);
    expect(factsOfType("achievement")).toHaveLength(8);
    expect(factsOfType("skill")).toHaveLength(13);
  });

  it("keeps the id each entry was verified under", () => {
    expect(byId("ACH-002")?.value).toEqual({
      statement: "반복 데이터 대응 시간 주 20시간 → 5시간 미만.",
    });
    expect(byId("SKL-010")?.value).toMatchObject({ name: "Welch's t-test" });
    expect(byId("EXP-003")?.value).toMatchObject({ title: "D3 Retention 영향 변수 분석" });
    expect(byId("EMP-001")?.value).toMatchObject({ employer: "주식회사 트리노드" });
  });

  it("gives every fact full provenance", () => {
    for (const fact of knowledge()) {
      expect(fact.source).toMatch(/^career-knowledge:/);
      expect(fact.author).toEqual({ kind: "representative" });
      expect(fact.confidence).toBe(1);
      expect(Number.isNaN(Date.parse(fact.acquiredAt))).toBe(false);
    }
  });

  it("carries each experience's limits rather than dropping them", () => {
    const retention = factsOfType("experience").find((f) => f.id === "EXP-003");

    expect(retention?.value.limits).toContain("인과관계 주장 금지");
    // A limit that goes missing is how a verified experience becomes a claim.
    for (const experience of factsOfType("experience")) {
      expect(experience.value.limits.trim()).not.toBe("");
    }
  });

  it("records what may not be claimed", () => {
    expect(prohibitions()).toContainEqual(expect.stringContaining("Hex"));
    expect(prohibitions()).toContainEqual(expect.stringContaining("AWS"));
    expect(factsOfType("prohibited_claim")).toHaveLength(5);
  });
});

describe("Every Career employee reads the same knowledge", () => {
  it("serves one store, whichever employee asks", () => {
    const reads = CAREER_EMPLOYEES.map((responsibility) => {
      // The employee exists and is real; the knowledge they read is the store.
      expect(employeeForResponsibility(responsibility).department).toBe("career");
      return knowledge();
    });

    for (const read of reads) {
      expect(read).toBe(reads[0]);
    }
  });

  it("cannot be given a per-employee view", () => {
    const source = readFileSync(
      join(import.meta.dirname, "capabilities/career/knowledge/index.ts"),
      "utf8",
    );

    // No reader takes an employee or a responsibility — there is nothing to
    // filter by, so two employees cannot hold different beliefs.
    expect(source).not.toContain("employeeId");
    expect(source).not.toContain("ResponsibilityId");
  });
});

describe("Missing information is a gap", () => {
  it("states what is not known and why", () => {
    for (const gap of gaps()) {
      expect(KNOWLEDGE_CATEGORIES).toContain(gap.category);
      expect(gap.what.trim()).not.toBe("");
      expect(gap.why.trim()).not.toBe("");
    }
  });

  it("names the profile fields the source never confirmed", () => {
    const what = gapsIn("profile").map((g) => g.what);

    expect(what).toContain("이름");
    expect(what).toContain("거주 지역");
    expect(what).toContain("팀명");
  });

  it("declares a gap for every category holding no facts", () => {
    for (const { category, facts, gaps: count } of coverage()) {
      if (facts === 0) {
        expect(count, `${category} has neither facts nor a gap`).toBeGreaterThan(0);
      }
    }
  });

  it("treats a résumé as an output, not as knowledge", () => {
    expect(factsIn("resume")).toHaveLength(0);
    expect(gapsIn("resume")[0].why).toContain("생성되는 산출물");
  });

  it("separates interview preparation from interview history", () => {
    // Prep material exists; no interview has happened. Folding these together
    // would make Career believe it knows about interviews it has never seen.
    expect(owns("interview_preparation")).toBe(true);
    expect(owns("interview_history")).toBe(false);
    expect(gapsIn("interview_history")).toHaveLength(1);
  });
});

describe("Never ask for what Career already owns", () => {
  it("answers whether a category is already held", () => {
    expect(owns("skills")).toBe(true);
    expect(owns("career_history")).toBe(true);
    expect(owns("achievements")).toBe(true);
    expect(owns("strengths")).toBe(true);
    expect(owns("weaknesses")).toBe(true);
    expect(owns("preferred_roles")).toBe(true);

    // Not held — these are the only ones an employee may raise, as gaps.
    expect(owns("application_history")).toBe(false);
    expect(owns("recruiter_feedback")).toBe(false);
    expect(owns("portfolio")).toBe(false);
  });

  it("holds every category either as facts or as a stated gap", () => {
    for (const { category, facts, gaps: count } of coverage()) {
      expect(facts + count, `${category} is silent`).toBeGreaterThan(0);
    }
  });
});

describe("Display is Career's own", () => {
  it("phrases a knowledge fact through Career, not through a surface", () => {
    const achievement = byId("ACH-001")!;

    expect(display(achievement)).toBe("Tableau 대시보드 15개 구축.");
    // Reached through Career's fact vocabulary, the way the desk asks for it.
    expect(displayCareerFact(achievement)).toBe("Tableau 대시보드 15개 구축.");
  });

  it("recognises its own vocabulary and leaves other facts alone", () => {
    expect(isKnowledgeFact(byId("SKL-001")!)).toBe(true);
    expect(
      isKnowledgeFact({
        id: "req-1",
        type: "jd_requirement",
        value: { statement: "SQL" },
        source: "handover.jdText:1",
        author: { kind: "external", name: "채용공고" },
        acquiredAt: "2026-01-01T00:00:00.000Z",
        confidence: 1,
      }),
    ).toBe(false);
  });
});

describe("Nothing was invented in transcription", () => {
  const sourceDir = join(
    import.meta.dirname,
    "../prototypes/resume-tailoring/source-data",
  );

  it("matches the verified achievements exactly", () => {
    const original = readFileSync(join(sourceDir, "achievements.md"), "utf8");

    for (const achievement of factsOfType("achievement")) {
      expect(original).toContain(achievement.value.statement);
    }
  });

  it("matches the verified skills exactly", () => {
    const original = readFileSync(join(sourceDir, "skills.md"), "utf8");

    for (const skill of factsOfType("skill")) {
      expect(original).toContain(skill.value.name);
      expect(original).toContain(skill.value.safeWording);
    }
  });

  it("matches the verified positioning gaps exactly", () => {
    const original = readFileSync(join(sourceDir, "positioning.md"), "utf8");

    for (const weakness of factsOfType("weakness")) {
      expect(original).toContain(weakness.value.statement);
    }
  });

  it("claims no skill the source forbids claiming", () => {
    const forbidden = factsOfType("prohibited_claim").map((f) => f.value.claim);
    const claimed = factsOfType("skill").map((f) => f.value.name);

    for (const claim of forbidden) {
      // "Hex 실무 경험" must not appear as a skill named Hex.
      const word = claim.split(" ")[0];
      expect(claimed).not.toContain(word);
    }
  });
});
