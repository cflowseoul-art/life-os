# Phase 1 — Organization Layer Reconstruction

# Summary

**Objective.** Make employees real organizational entities. Establish the chain
`Employee → Responsibility → Capability → Runner`, so that employees may change
while capability code stays identical. No feature work, no UI, no knowledge
changes.

**Commit.** `f8f58a8` — *refactor(company): employees become organizational
entities*

**Branch.** `recovery/mobile-ui-20260802`

**Overall result.** Complete. 12 files, +677 / −133. Core typecheck clean. 118
tests: 115 pass, 3 fail — the same three that failed before Phase 0.5, carried
forward and documented below. The office seats the same people at the same
desks; nothing the representative sees moved.

---

# The Layer

```
Employee            who works here            employees.ts (ROSTER)
    │                                          id, surname, title, department
    │ assigned to
    ▼
Responsibility      what someone is            responsibilities.ts
    │               accountable for            typed id → employeeId
    │ grouped into
    ▼
Capability          business logic             manifest.ts
    │               declares its                responsibilities[] + accountableFor
    │ executed by
    ▼
Runner              execution                  runner.ts registry
                    declares one                keyed by ResponsibilityId
                    responsibility
```

Each arrow is one-way. A capability never resolves an employee; a runner never
chooses one; a department never stands in for one.

## Why this was necessary

The company answered "who does this?" with `employeeFor(department)`, which
returned **the first active employee in the roster for that department**. Three
consequences, all invisible:

1. A department could hold exactly one accountable employee. Career had six
   people on the roster and one of them signed every report, regardless of who
   did the work.
2. `employeeForDuty(department, duty)` fell back to that same first employee
   when no duty matched. Duties were Korean string literals duplicated between
   the roster and the runner that used them, so renaming one in either place
   silently misattributed work — no error, no type failure, no test.
3. An unstaffed department got a **derived surname**, computed from the
   character codes of the department name, so a report with nobody behind it
   still looked signed.

---

# Responsibilities

New file: `core/company/responsibilities.ts`.

`ResponsibilityId` is a typed union — `career.fit-analysis`,
`home.provisioning`, `finance.ledger-review`, and ten others. A misspelled
responsibility is a compile error, which is the point: the strings it replaces
were runtime-only.

```ts
type Responsibility = {
  id: ResponsibilityId;
  department: Department;   // organizational grouping, never a lookup key
  label: string;            // 적합성 분석
  employeeId: string;       // explicit; there is no default
};
```

Thirteen responsibilities are declared, one line each. Six belong to Career —
one per stage of an application — and the rest are single-responsibility
departments plus `ceo.office` and `operations.intake`.

`responsibility(id)` throws on an unregistered id. There is no fallback.

**Replacing an employee is editing one `employeeId` in this table.**

---

# Employees

`core/company/employees.ts` now answers one question: who works here.

**Removed:**

- `employeeFor(department)` — the department→employee binding, and the
  derived-surname invention inside it.
- `employeeForDuty(department, duty)` — and its silent fallback.
- `Employee.duty` — no string duties anywhere.
- `Employee.currentWork` — declared, never used.

**Added:**

- `employeeById(id)` — throws on an unknown or inactive employee.
- `employeeForResponsibility(id)` — the only path to a person.
- `signature(responsibilityId)` — now returns the responsibility it signed for
  alongside name, title, and department.

The `ROSTER` order carries no meaning any more. Nothing resolves an employee by
being listed first.

---

# Manifest

`CapabilityManifest` lost `department`, `employeeId`, and `runnerModule`. It
gained:

```ts
responsibilities: ResponsibilityId[];   // everything this capability comprises
accountableFor:   ResponsibilityId;     // exactly one — signs, receives work
runners?:         Partial<Record<ResponsibilityId, string>>;
```

Career declares **six** responsibilities and a runner for **one**. That is the
truth about Career, and the previous shape could not express it: a capability
had one employee and one runner or it had nothing.

New accessors: `accountableResponsibility(capability)`,
`accountableForWork(name)`, `capabilityForResponsibility(id)`,
`departmentOf(capability)`, `runnableResponsibilities()`.

`accountableForWork` also answers for a function department that owns no
capability — Operations holds a request until a domain department can be named —
by resolving its own intake responsibility. It returns `null` for a name the
company does not recognise, and each caller decides whether that is an error
(work orders: yes) or simply nobody to display (report contributor: shows 회사).

**`validateManifest()` now checks:** every declared responsibility is
registered; every one resolves to an *active* employee; `accountableFor` is
among them; no responsibility is claimed by two capabilities; all of a
capability's responsibilities sit in one department; a runner is only declared
for a responsibility the capability owns; an enabled or scheduled capability has
a runner for its accountable responsibility.

---

# Dispatch

`CapabilityRunner` → `ResponsibilityRunner`. Its `id: string` became
`responsibility: ResponsibilityId`.

The registry is keyed by `ResponsibilityId`. `loadRunner(id, module)` refuses a
module whose runner declares a different responsibility — previously a
capability-id mismatch, now an accountability mismatch, which is the stronger
check.

`runnerModuleFor(responsibilityId)` throws when no runner is declared. Callers
updated: `desk-api.ts` (intake, receipts, answer, revise), `schedule.ts`
(wakes the accountable responsibility), `warmRunners()` (loads every runnable
responsibility at boot, so a missing one fails at startup).

The outstanding-Ask lookup now carries the responsibility that must answer it,
so answering and revising dispatch by responsibility rather than by capability.

---

# Signatures

Everything that signs now resolves through a responsibility:

| Site | Before | After |
|---|---|---|
| `desk-api.ts` report | `signature(hold.capability)` | `signature(accountableFor(hold.capability))` |
| `work-order.ts` assignee | `employeeFor(event.capability)` | `employeeForResponsibility(accountableFor(...))` |
| `work-order.ts` intake | `const ACCEPTED_BY = "서비서 실장"` | `signature("ceo.office")` |
| `reports/templates.ts` | `employeeFor("career").displayName` | `contributorName("career")` |

The hardcoded intake signature is worth noting: it was a string literal, so
replacing the CEO-office employee would not have changed it. It now resolves,
and produces the identical text.

Career's runner previously called `employeeForDuty("career", "적합성 분석")`.
It now calls `employeeForResponsibility("career.fit-analysis")`. The lookup
remains — Career prints the analyst's name in a report heading — but it is typed
and cannot silently resolve to the wrong person.

---

# Deleted Logic

| Removed | Why unnecessary |
|---|---|
| `employeeFor(department)` | A department organizes employees; it does not resolve one |
| Derived-surname fallback (`charCodeAt` seeding) | An unsigned report must not look signed |
| `employeeForDuty()` + its fallback to the first employee | Assignment is explicit and total |
| `Employee.duty` (6 Korean literals) | Replaced by typed `ResponsibilityId` |
| `Employee.currentWork` | Declared, never read |
| Duty strings duplicated in `career/runner.ts` | Same ids, now compile-checked |
| `manifest.department` / `manifest.employeeId` | Manifest binds responsibilities |
| `manifest.runnerModule` (one per capability) | Runners are per responsibility |
| `ACCEPTED_BY` string literal | A signature must come from a person |
| Manifest validation comparing `employeeId` to the department's first employee | The binding it validated no longer exists |

---

# Tests

118 tests: **115 pass, 3 fail.** All three failures pre-date Phase 0.5. New file
`core/organization.test.ts` (18 tests), all passing.

**Assignment** — *pass.* Every declared responsibility resolves to an active
employee; unknown employee throws; unknown responsibility throws; `employees.ts`
contains no `employeeFor(`, no `employeeForDuty`, and no `charCodeAt`; no
employee carries a `duty`.

**Signatures** — *pass.* Two responsibilities in the same department produce two
different signatures — the case the old model could not represent. Each
signature names the responsibility it signed for.

**Employee replacement (the acceptance test)** — *pass.* Reassigning
`career.fit-analysis` to a different employee and re-running Career's intake:
recorded facts identical (ids, types, values, sources, authors, confidences);
Ask facts identical; artifact section count identical; exactly **one** heading
differs, and only by the person's name. Restored in `finally`. A second test
asserts no capability source file imports `employees.ts` or contains an
employee id.

**Dispatch** — *pass.* Exactly three runnable responsibilities;
`runnerModuleFor` throws for declared-but-unstaffed responsibilities rather than
substituting another; `loadRunner` refuses a runner claiming a different
responsibility; each runner declares the responsibility it executes.

**Manifest** — *pass.* `validateManifest()` does not throw; no capability
carries `department`, `employeeId`, or `runnerModule`; Career holds six
responsibilities and one runner; `accountableForWork("operations")` resolves and
`accountableForWork("nonsense")` returns null.

**Regression** — *pass.* `companyRoster()` seats the same seven people at the
same desks with the same titles as before the split.

**Career / Home / Finance** — *unchanged.* All Phase 0.5 knowledge, projection,
and formatting tests pass untouched.

---

# Remaining Technical Debt

1. **Three pre-existing test failures, one root cause.**
   `capabilities/career/index.ts` drops requirements shorter than four
   characters, so `SQL` never becomes a fact — the fixture JD has three bullets
   and yields two. Inherited; belongs with the Job Fit Analyst rebuild.

2. **`test/inventory-command-parser.contract.test.ts` has no test suite** and
   fails to collect. Unrelated; keeps the suite red.

3. **Career's runner still executes three responsibilities.** It declares
   `career.fit-analysis` and also performs application strategy and résumé
   editing inside `answer()`. The dispatch layer can now address them
   separately; splitting the runner is a later phase and was explicitly out of
   scope here.

4. **The hold does not record which responsibility raised an Ask.** Answering
   resolves the capability's accountable responsibility instead. Correct while
   each capability has one runner; a stage machine will need the responsibility
   on the event.

5. **`INFERENCE_CONFIDENCE = 0.5` is still declared, not measured.** Carried
   from Phase 0.5.

6. **`derivedFrom` on facts is still unpopulated**, and `Author`'s `employee`
   variant is now *reachable* but still unused — no employee authors a fact yet.

7. **Frontend has 5 pre-existing `TS6133` errors** in `OfficeGame.tsx` and
   `LifeOfficeDemo.tsx`. No frontend file was touched this phase.

---

# Phase 2 Prerequisites

Phase 2 is **Career Knowledge**: the department's permanent professional memory,
read by every Career employee.

What must be true before it starts, and what this phase delivered toward it:

1. **Employees are addressable.** `Author`'s `{ kind: "employee"; employeeId }`
   variant can now be constructed from `employeeForResponsibility(id).id`.
   Career Knowledge facts authored by an employee — recruiter feedback recorded
   by application operations, an assessment by the interview coach — are
   expressible for the first time. This was the blocking dependency and it is
   resolved.

2. **Career's six responsibilities exist and are assigned.** Knowledge is shared
   across all of them, so the readers are already named:
   `career.fit-analysis`, `career.application-strategy`,
   `career.resume-editing`, `career.cover-letter`, `career.interview-prep`,
   `career.application-operations`.

3. **Decide the write path.** Who may author a Career Knowledge fact —
   representative only, or employees too? The `Author` type permits both. This
   determines whether knowledge is an authored durable store or an event-derived
   projection. `capabilities/home/memory.ts` is *not* the model: a résumé is not
   reconstructible from utterances.

4. **Declare the Career fact vocabulary.** `capabilities/career/facts.ts`
   currently declares one type, `jd_requirement`. The vocabulary from the
   department specification — profile, career history, résumé, portfolio,
   projects, achievements, KPIs, skills, interview history, application history,
   recruiter feedback, strengths, weaknesses, preferred industries, preferred
   roles — extends that union. The kernel does not need to change.

5. **Seed from `prototypes/resume-tailoring/source-data/`.** It already holds
   hand-verified profile, skills, achievements, positioning, constraints,
   experiences, projects, and interview material, with a canonical tag index.
   That content becomes product data.

6. **Settle the gap rule.** A Career employee must never ask for information
   Career already owns. A fact missing from knowledge is a reported **gap** —
   never a question back to the representative, never an invention.
