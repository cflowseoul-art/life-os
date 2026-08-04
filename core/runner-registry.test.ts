/**
 * The runner registry, as executable checks.
 *
 * One responsibility, one runner. The three ways that can go wrong — nothing
 * registered, two things registered, or a runner filed under the wrong
 * responsibility — all throw rather than resolving to something plausible.
 */

import { describe, expect, it } from "vitest";

import {
  hasRunner,
  loadRunner,
  register,
  registeredResponsibilities,
  runnerFor,
} from "./company/runner.ts";
import type { ResponsibilityRunner } from "./company/runner.ts";
import type { ResponsibilityId } from "./company/responsibilities.ts";

/** A runner that executes nothing. Only its declared responsibility matters. */
function stub(responsibility: ResponsibilityId): ResponsibilityRunner {
  return { responsibility, accept: () => ({ ok: true }) };
}

describe("One runner per responsibility", () => {
  it("returns the runner registered for a responsibility", () => {
    const runner = stub("career.resume_editor");
    register(runner, "./resume-editor.ts");

    expect(runnerFor("career.resume_editor")).toBe(runner);
    expect(hasRunner("career.resume_editor")).toBe(true);
    expect(registeredResponsibilities()).toContain("career.resume_editor");
  });

  it("files a runner under the responsibility it declares, not one it is given", () => {
    const runner = stub("career.interview_coach");
    register(runner, "./interview-coach.ts");

    // There is no id parameter to disagree with the runner's own declaration.
    expect(runnerFor("career.interview_coach")).toBe(runner);
  });

  it("is idempotent for the same module", () => {
    const runner = stub("career.cover_letter");

    expect(register(runner, "./cover-letter.ts")).toBe(runner);
    expect(register(runner, "./cover-letter.ts")).toBe(runner);
    expect(registeredResponsibilities().filter((r) => r === "career.cover_letter"))
      .toHaveLength(1);
  });
});

describe("Missing runner", () => {
  it("throws rather than returning nothing", () => {
    expect(() => runnerFor("career.portfolio_editor")).toThrow(/등록된 러너가 없습니다/);
    expect(hasRunner("career.portfolio_editor")).toBe(false);
  });

  it("throws when the module exports no runner", async () => {
    await expect(
      loadRunner("career.application_operator", "../events/types.ts"),
    ).rejects.toThrow(/러너를 내보내지 않았습니다/);
  });

  it("throws when the module cannot be found", async () => {
    await expect(
      loadRunner("career.application_operator", "../capabilities/career/nothing-here.ts"),
    ).rejects.toThrow();
  });
});

describe("Duplicate runner", () => {
  it("throws when a second module claims a registered responsibility", () => {
    register(stub("career.application_strategy"), "./strategist.ts");

    expect(() => register(stub("career.application_strategy"), "./other-strategist.ts"))
      .toThrow(/두 번 등록되었습니다/);
  });

  it("names both modules in the failure", () => {
    register(stub("home.provisioning"), "./home-a.ts");

    expect(() => register(stub("home.provisioning"), "./home-b.ts"))
      .toThrow(/home-a\.ts.*home-b\.ts/);
  });

  it("keeps the first registration rather than half-applying the second", () => {
    const first = stub("finance.ledger-review");
    register(first, "./finance-a.ts");

    expect(() => register(stub("finance.ledger-review"), "./finance-b.ts")).toThrow();
    expect(runnerFor("finance.ledger-review")).toBe(first);
  });
});

describe("Wrong responsibility", () => {
  it("refuses a module whose runner declares a different responsibility", async () => {
    await expect(
      loadRunner("career.portfolio_editor", "../capabilities/career/runner.ts"),
    ).rejects.toThrow(/맡은 책임이 다릅니다/);

    // The failed load registered nothing.
    expect(hasRunner("career.portfolio_editor")).toBe(false);
  });

  it("loads a real runner under its own responsibility", async () => {
    const runner = await loadRunner("career.job_fit", "../capabilities/career/runner.ts");

    expect(runner.responsibility).toBe("career.job_fit");
    expect(runnerFor("career.job_fit")).toBe(runner);
  });
});
