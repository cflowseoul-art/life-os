/**
 * The employee registry, as executable checks.
 *
 * One question, asked by id: **who owns `career.job_fit`?**
 *
 * The rules that make the answer trustworthy: every employee owns exactly one
 * responsibility, every responsibility has exactly one owner, and anything
 * missing or doubled fails immediately rather than resolving to whoever happens
 * to be nearby.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  EMPLOYEES,
  employeeForResponsibility,
  responsibilityOwnedBy,
  rosterProblems,
} from "./company/employees.ts";
import {
  RESPONSIBILITIES,
  assignmentProblems,
  ownerOf,
  responsibilityOf,
} from "./company/responsibilities.ts";
import type { Responsibility } from "./company/responsibilities.ts";

/** The seven stages of an application, one employee each. */
const CAREER_RESPONSIBILITIES = [
  "career.job_fit",
  "career.application_strategy",
  "career.resume_editor",
  "career.portfolio_editor",
  "career.cover_letter",
  "career.interview_coach",
  "career.application_operator",
] as const;

/** A minimal well-formed row, for testing the rules against synthetic tables. */
function row(id: string, employeeId: string): Responsibility {
  return { id, department: "career", label: "테스트", employeeId } as Responsibility;
}

describe("Career responsibilities", () => {
  it("declares all seven, and each is owned by exactly one employee", () => {
    for (const id of CAREER_RESPONSIBILITIES) {
      const declared = RESPONSIBILITIES.filter((r) => r.id === id);

      expect(declared).toHaveLength(1);
      expect(employeeForResponsibility(id).status).toBe("active");
      expect(ownerOf(id)).toBe(declared[0].employeeId);
    }
  });

  it("gives every Career employee exactly one responsibility", () => {
    const career = EMPLOYEES.filter((e) => e.department === "career");

    expect(career).toHaveLength(CAREER_RESPONSIBILITIES.length);

    const owned = career.map((e) => responsibilityOwnedBy(e.id));

    expect([...owned].sort()).toEqual([...CAREER_RESPONSIBILITIES].sort());
    // One each: no employee appears twice, nobody is left out.
    expect(new Set(owned).size).toBe(career.length);
  });

  it("answers who owns a responsibility, by id alone", () => {
    const owner = employeeForResponsibility("career.job_fit");

    expect(owner.id).toBe("emp-career-001");
    expect(responsibilityOwnedBy(owner.id)).toBe("career.job_fit");
  });
});

describe("Failing immediately", () => {
  it("throws on a missing assignment rather than choosing somebody", () => {
    expect(() => responsibilityOwnedBy("emp-career-999")).toThrow(/맡은 책임이 없는/);
    expect(responsibilityOf("emp-career-999")).toBeNull();
  });

  it("rejects a duplicate responsibility declaration", () => {
    const problems = assignmentProblems([
      row("career.job_fit", "emp-a"),
      row("career.job_fit", "emp-b"),
    ]);

    expect(problems).toContainEqual(expect.stringContaining("중복 선언"));
  });

  it("rejects one employee owning two responsibilities", () => {
    const problems = assignmentProblems([
      row("career.job_fit", "emp-a"),
      row("career.resume_editor", "emp-a"),
    ]);

    expect(problems).toContainEqual(expect.stringContaining("emp-a"));
  });

  it("rejects a responsibility with nobody assigned", () => {
    expect(assignmentProblems([row("career.job_fit", "")]))
      .toContainEqual(expect.stringContaining("배정되지 않았습니다"));
  });

  it("rejects an employee who owns nothing", () => {
    const problems = rosterProblems(
      [{ id: "emp-a" }, { id: "emp-orphan" }],
      [{ id: "career.job_fit", employeeId: "emp-a" }],
    );

    expect(problems).toContainEqual(expect.stringContaining("emp-orphan"));
  });

  it("rejects an assignment to somebody not on the roster", () => {
    const problems = rosterProblems(
      [{ id: "emp-a" }],
      [
        { id: "career.job_fit", employeeId: "emp-a" },
        { id: "career.resume_editor", employeeId: "emp-ghost" },
      ],
    );

    expect(problems).toContainEqual(expect.stringContaining("emp-ghost"));
  });

  it("finds nothing wrong with the real registry", () => {
    expect(assignmentProblems(RESPONSIBILITIES)).toEqual([]);
    expect(rosterProblems(EMPLOYEES, RESPONSIBILITIES)).toEqual([]);
  });
});

describe("No free-text duties", () => {
  /** Every .ts file under core/, so a duty string cannot hide in a new one. */
  function coreSources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return coreSources(path);
      return path.endsWith(".ts") ? [path] : [];
    });
  }

  /** Source with comments removed — prose may name a duty; code may not. */
  function code(path: string): string {
    return readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  it("keeps Korean duty names out of employee resolution", () => {
    // The strings that used to be compared to decide who does what.
    const duties = ["적합성 분석", "지원 전략", "이력서 편집", "자기소개서", "면접 준비", "지원 관리"];

    for (const path of coreSources(import.meta.dirname)) {
      // They survive only as display labels in the registry, and in this test.
      if (path.endsWith("company/responsibilities.ts")) continue;
      if (path.endsWith("registry.test.ts")) continue;
      // Known debt, outside this layer: `continuation.ts` starts follow-on work
      // by matching a job title and names the next step "면접 준비" as a work
      // subject. It resolves no employee, so it is not a duty comparison — but
      // it is the last Korean phrase in the codebase doing identifier work.
      if (path.endsWith("company/continuation.ts")) continue;

      const source = code(path);

      for (const duty of duties) {
        expect(source, `${path} still names a duty`).not.toContain(duty);
      }
    }
  });

  it("carries the label as display only, never as an identifier", () => {
    // Career only: other departments' ids were declared in an earlier step and
    // still use a hyphen (`finance.ledger-review`).
    const career = RESPONSIBILITIES.filter((r) => r.department === "career");

    for (const entry of career) {
      // The id is the canonical identifier; the label never appears in one.
      expect(entry.id).toMatch(/^career\.[a-z_]+$/);
      expect(entry.id).not.toContain(entry.label);
    }
  });
});
