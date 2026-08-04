/**
 * The organization layer, as executable checks.
 *
 * The chain under test:  Employee → Responsibility → Capability → Runner.
 *
 * The property that matters most is the one in `Employee replacement`: swapping
 * a person must move a signature and change nothing else. Everything else here
 * exists to make that property hard to lose — no lookup by department, no silent
 * fallback, no duty strings, and dispatch keyed by responsibility.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EventLog } from "./events/log.ts";
import {
  EMPLOYEES,
  employeeById,
  employeeForResponsibility,
  signature,
} from "./company/employees.ts";
import {
  RESPONSIBILITIES,
  knownResponsibility,
  responsibility,
} from "./company/responsibilities.ts";
import {
  CAPABILITIES,
  accountableForWork,
  companyRoster,
  runnableResponsibilities,
  runnerModuleFor,
  validateManifest,
} from "./company/manifest.ts";
import { loadRunner } from "./company/runner.ts";
import { runner as careerRunner } from "./capabilities/career/runner.ts";
import type { ActorContext } from "./identity/types.ts";

const JD = `Data Analyst

Responsibilities
- Python 데이터 분석
- Dashboard 운영
- 실험 설계와 해석
`;

function freshLog(): EventLog {
  return new EventLog(join(mkdtempSync(join(tmpdir(), "lifeos-org-")), "events.jsonl"));
}

/** Runs Career's intake and returns everything it recorded. */
/** The representative the seed is bound to, so the analyst reads real knowledge. */
process.env.LIFE_OS_CAREER_SEED_EMAIL = "owner@example.com";

const ACTOR = {
  user: { id: "usr-1", email: "owner@example.com" },
  household: { id: "hh-1", ownerUserId: "usr-1" },
} as ActorContext;

function runCareer(log: EventLog): {
  facts: { value: unknown; author: unknown }[];
  headings: string[];
  askFacts: string[];
} {
  careerRunner.accept({
    actor: ACTOR,
    log,
    subject: "OpenAI · Data Analyst",
    request: JD,
    attachment: "",
  });

  const events = log.read();

  return {
    // Everything about a fact except when it was acquired — two runs happen at
    // two different moments, and that difference is not the department's doing.
    // The analyst's own conclusions. Candidate sightings are authored by the
    // posting, not by whoever read it, so they say nothing about replacement.
    facts: events.flatMap((e) =>
      e.event.type === "KnowledgeFactRecorded" && e.event.fact.type === "fit_finding"
        ? [{ value: e.event.fact.value, author: e.event.fact.author }]
        : [],
    ),
    headings: events.flatMap((e) =>
      e.event.type === "ArtifactKept" ? e.event.artifact.sections.map((s) => s.heading) : [],
    ),
    askFacts: events.flatMap((e) => (e.event.type === "AskRaised" ? e.event.ask.facts : [])),
  };
}

describe("Assignment is explicit", () => {
  it("resolves every declared responsibility to an active employee", () => {
    for (const r of RESPONSIBILITIES) {
      const employee = employeeForResponsibility(r.id);
      expect(employee.status).toBe("active");
      expect(employee.id).toBe(r.employeeId);
    }
  });

  it("refuses an unknown employee rather than inventing one", () => {
    expect(() => employeeById("emp-nobody-999")).toThrow(/명부에 없는/);
  });

  it("refuses an unknown responsibility rather than defaulting", () => {
    // @ts-expect-error — an unregistered responsibility is not a valid id.
    expect(() => responsibility("career.nonexistent")).toThrow(/배정되지 않은/);
    expect(knownResponsibility("career.nonexistent")).toBe(false);
  });

  it("never resolves an employee from a department", () => {
    const employees = readFileSync(join(import.meta.dirname, "company/employees.ts"), "utf8");

    // The old binding and the old fallback, both gone by name.
    expect(employees).not.toContain("employeeFor(");
    expect(employees).not.toContain("employeeForDuty");
    // No derived-surname invention for an unstaffed department.
    expect(employees).not.toContain("charCodeAt");
  });

  it("carries no duty strings on an employee", () => {
    for (const employee of EMPLOYEES) {
      expect(employee).not.toHaveProperty("duty");
    }
  });
});

describe("Signatures come from the responsible employee", () => {
  it("gives two responsibilities in one department two different signatures", () => {
    const analyst = signature("career.job_fit");
    const editor = signature("career.resume_editor");

    expect(analyst.name).not.toBe(editor.name);
    // Same department, different people — the case the old model could not hold.
    expect(analyst.department).toBe(editor.department);
    expect(analyst.responsibility).toBe("career.job_fit");
    expect(editor.responsibility).toBe("career.resume_editor");
  });

  it("names the responsibility it signed for", () => {
    expect(signature("home.provisioning").name)
      .toBe(employeeForResponsibility("home.provisioning").displayName);
  });
});

describe("Employee replacement", () => {
  it("changes signatures and nothing else", () => {
    const target = RESPONSIBILITIES.find((r) => r.id === "career.job_fit")!;
    const original = target.employeeId;

    const before = runCareer(freshLog());
    const beforeName = signature("career.job_fit").name;

    try {
      // A different person takes over the same responsibility.
      target.employeeId = "emp-career-004";

      const after = runCareer(freshLog());
      const afterName = signature("career.job_fit").name;

      expect(afterName).not.toBe(beforeName);

      // The report is identical. No heading and no body carries a person's
      // name — the desk renders the signature, so the content need not.
      expect(after.headings).toEqual(before.headings);

      // The Ask the representative sees is untouched.
      expect(after.askFacts).toEqual(before.askFacts);

      // Conclusions are identical; only who authored them moved.
      expect(after.facts.map((f) => f.value)).toEqual(before.facts.map((f) => f.value));
      expect(after.facts.map((f) => f.author)).not.toEqual(before.facts.map((f) => f.author));
      for (const fact of after.facts) {
        expect(fact.author).toEqual({ kind: "employee", employeeId: "emp-career-004" });
      }
    } finally {
      target.employeeId = original;
    }
  });

  it("requires no capability code to know a person", () => {
    const capabilitySources = [
      "capabilities/career/index.ts",
      "capabilities/career/job-fit.ts",
      "capabilities/career/facts.ts",
      "capabilities/home/index.ts",
      "capabilities/home/facts.ts",
      "capabilities/home/memory.ts",
      "capabilities/finance/facts.ts",
    ].map((f) => readFileSync(join(import.meta.dirname, f), "utf8"));

    for (const source of capabilitySources) {
      // Business logic never names, resolves, or imports a person.
      expect(source).not.toContain("employees.ts");
      expect(source).not.toContain("emp-");
    }
  });
});

describe("Dispatch is by responsibility", () => {
  it("declares a runner per responsibility, not per capability", () => {
    const runnable = runnableResponsibilities().map((r) => r.id).sort();

    expect(runnable).toEqual([
      "career.application_operator",
      "career.job_fit",
      "finance.ledger-review",
      "home.provisioning",
    ]);
  });

  it("errors on a responsibility that cannot execute — never substitutes another", () => {
    // Declared, assigned, and deliberately unstaffed.
    expect(() => runnerModuleFor("career.resume_editor")).toThrow(/러너가 선언되지 않았습니다/);
    expect(() => runnerModuleFor("career.interview_coach")).toThrow(/러너가 선언되지 않았습니다/);
  });

  it("refuses a runner that claims a different responsibility", async () => {
    await expect(
      loadRunner("career.cover_letter", "../capabilities/career/runner.ts"),
    ).rejects.toThrow(/맡은 책임이 다릅니다/);
  });

  it("has every runner declare the responsibility it executes", () => {
    expect(careerRunner.responsibility).toBe("career.job_fit");
  });
});

describe("The manifest binds responsibilities", () => {
  it("starts only when its own description is consistent", () => {
    expect(() => { validateManifest(); }).not.toThrow();
  });

  it("declares responsibilities rather than a department and an employee", () => {
    for (const capability of CAPABILITIES) {
      expect(capability.responsibilities.length).toBeGreaterThan(0);
      expect(capability.responsibilities).toContain(capability.accountableFor);
      expect(capability).not.toHaveProperty("department");
      expect(capability).not.toHaveProperty("employeeId");
      expect(capability).not.toHaveProperty("runnerModule");
    }
  });

  it("lets a capability hold more responsibilities than it can execute", () => {
    const career = CAPABILITIES.find((c) => c.id === "career")!;

    expect(career.responsibilities).toHaveLength(7);
    // Two of seven can execute; the rest are declared and unstaffed.
    expect(Object.keys(career.runners ?? {}).sort()).toEqual([
      "career.application_operator",
      "career.job_fit",
    ]);
  });

  it("seats the same people at the same desks as before the split", () => {
    // The office is unchanged: reorganizing how a person is *resolved* must not
    // move anybody. Resolution changed; the company did not.
    expect(companyRoster().map((d) => `${d.floor} ${d.name} ${d.title}`)).toEqual([
      "5F 서비서 실장",
      "4F 김재무 팀장",
      "4F 최자산 팀장",
      "3F 오운용 팀장",
      "2F 한살림 선임",
      "2F 정건강 대리",
      "1F 박진로 선임",
    ]);
  });

  it("answers for a function department that owns no capability", () => {
    expect(accountableForWork("operations")).toBe("operations.intake");
    // A name the company does not recognise gets nobody, not a stand-in.
    expect(accountableForWork("nonsense")).toBeNull();
  });
});
