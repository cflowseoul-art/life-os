/**
 * Manifest ↔ runner registry agreement, as executable checks.
 *
 * Two declarations have to match: what the manifest says can run, and what
 * actually loaded. They are written in different places and checked here, once,
 * at startup — before the port opens, so a mismatch is a failed boot rather than
 * a failed request.
 */

import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  runnableResponsibilities,
  runnerProblems,
  validateManifest,
  validateRunners,
} from "./company/manifest.ts";
import type { CapabilityManifest } from "./company/manifest.ts";
import type { ResponsibilityId } from "./company/responsibilities.ts";

/** A minimal enabled capability, so each test states only what it is about. */
function capability(over: Partial<CapabilityManifest>): CapabilityManifest {
  return {
    id: "career",
    displayName: "테스트",
    responsibilities: ["career.job_fit"],
    accountableFor: "career.job_fit",
    scope: "personal",
    officeFloor: 1,
    producesReports: true,
    appearsInOffice: true,
    scheduler: "none",
    routing: { decisionSignals: ["테스트"], subjectSignals: [] },
    enabled: true,
    ...over,
  };
}

describe("A declared runner must be registered", () => {
  it("fails when an enabled capability declares a runner that never loaded", () => {
    const problems = runnerProblems(
      [capability({ runners: { "career.job_fit": "./job-fit.ts" } })],
      [],
    );

    expect(problems).toContainEqual(expect.stringContaining("등록되지 않았습니다"));
  });

  it("passes when the declared runner is registered", () => {
    const problems = runnerProblems(
      [capability({ runners: { "career.job_fit": "./job-fit.ts" } })],
      ["career.job_fit"],
    );

    expect(problems).toEqual([]);
  });

  it("does not require a runner from a disabled capability", () => {
    // A disabled capability is never warmed, so nothing should have loaded.
    const problems = runnerProblems(
      [capability({ enabled: false, runners: { "career.job_fit": "./job-fit.ts" } })],
      [],
    );

    expect(problems).toEqual([]);
  });

  it("does not require a runner for a responsibility that declares none", () => {
    // Career declares seven stages and staffs one. That is a true statement
    // about the company, not a misconfiguration.
    const problems = runnerProblems(
      [
        capability({
          responsibilities: ["career.job_fit", "career.resume_editor", "career.interview_coach"],
          runners: { "career.job_fit": "./job-fit.ts" },
        }),
      ],
      ["career.job_fit"],
    );

    expect(problems).toEqual([]);
  });
});

describe("A registered runner must be declared", () => {
  it("fails when a runner loaded for a responsibility nothing declares", () => {
    const problems = runnerProblems(
      [capability({ runners: { "career.job_fit": "./job-fit.ts" } })],
      ["career.job_fit", "career.portfolio_editor"],
    );

    expect(problems).toContainEqual(
      expect.stringContaining("선언되지 않은 책임의 러너가 등록되었습니다"),
    );
  });

  it("names the offending responsibility", () => {
    const problems = runnerProblems([capability({ runners: {} })], ["home.provisioning"]);

    expect(problems.join("\n")).toContain("home.provisioning");
  });
});

describe("Exactly one runner per responsibility", () => {
  it("fails when two capabilities declare a runner for the same responsibility", () => {
    const problems = runnerProblems(
      [
        capability({ id: "career", runners: { "career.job_fit": "./a.ts" } }),
        capability({ id: "home", runners: { "career.job_fit": "./b.ts" } }),
      ],
      ["career.job_fit"],
    );

    expect(problems).toContainEqual(expect.stringContaining("중복 선언"));
  });
});

describe("Startup", () => {
  it("throws with every problem listed, not just the first", () => {
    expect(() =>
      validateRunners(["career.portfolio_editor", "career.cover_letter"] as ResponsibilityId[]),
    ).toThrow(/러너 선언이 올바르지 않습니다/);
  });

  it("accepts the registry the real manifest produces", () => {
    // What `warmRunners()` loads at boot, checked against what is declared.
    const warmed = runnableResponsibilities().map((r) => r.id);

    expect(() => { validateRunners(warmed); }).not.toThrow();
    expect(runnerProblems(CAPABILITIES, warmed)).toEqual([]);
  });

  it("still accepts the manifest's own description", () => {
    expect(() => { validateManifest(); }).not.toThrow();
  });

  it("declares a runner for every accountable responsibility that is enabled", () => {
    for (const c of CAPABILITIES.filter((x) => x.enabled)) {
      expect(c.runners?.[c.accountableFor]).toBeTruthy();
    }
  });
});
