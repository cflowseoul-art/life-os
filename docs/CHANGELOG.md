# Changelog

Newest first. One entry per phase. Architecture as it stands is in
`ARCHITECTURE_STATE.md`; reasoning is in the phase reports.

---

## Phase 1 — Organization Layer Reconstruction

`f8f58a8` · report: `PHASE_1_IMPLEMENTATION_REPORT.md`

Employees became real organizational entities. The chain is now
`Employee → Responsibility → Capability → Runner`.

**Added**
- `core/company/responsibilities.ts` — typed `ResponsibilityId` union and one
  assignment table. Thirteen responsibilities, each mapped to exactly one
  employee.
- `employeeById()`, `employeeForResponsibility()`, `accountableForWork()`,
  `capabilityForResponsibility()`, `runnableResponsibilities()`.
- `core/organization.test.ts` — 18 tests.

**Changed**
- The manifest binds `responsibilities[]` and one `accountableFor` instead of a
  department and an employee. Runners are declared per responsibility, so a
  capability may hold more responsibilities than it can execute — Career
  declares six and staffs one.
- Runner dispatch is keyed by `ResponsibilityId`. `CapabilityRunner` became
  `ResponsibilityRunner` and declares the one responsibility it executes; a
  mismatch is refused at load.
- `signature()` takes a responsibility and returns the one it signed for. Report
  contributors, work-order assignees, and the office roster all resolve through
  it.
- Work-order intake is signed by the CEO office responsibility instead of a
  hardcoded string.

**Removed**
- `employeeFor(department)` — the department→employee binding, which limited
  every department to one accountable employee.
- The derived-surname invention that let an unsigned report look signed.
- `employeeForDuty()` and its silent fallback to the first employee.
- `Employee.duty` (six Korean string literals) and `Employee.currentWork`.
- `manifest.department`, `manifest.employeeId`, `manifest.runnerModule`.

**Behaviour** — unchanged. The office seats the same seven people at the same
desks with the same titles, and intake is signed by the same name. Capability
output, runner behaviour, and knowledge are identical: asserted by reassigning
`career.fit-analysis` to a different employee and confirming only one artifact
heading differs.

**Tests** — 118 total, 115 passing. Three inherited failures (QA-01).

---

## Phase 0.5 — KnowledgeFact Foundation

`4523d77` · report: `PHASE_0_5_IMPLEMENTATION_REPORT.md`

`Observation` became `KnowledgeFact`. Persisted schema version 3.

**Added**
- `KnowledgeFact<type, value>` with a required `Author`, generic over a
  department-owned type and value the kernel never inspects.
- `Author` — `representative` · `employee` · `system` · `external` ·
  `unattributed`.
- `core/events/migrate.ts` — read-time upcast, wired into both storage adapters.
- `facts.ts` per department, owning its vocabulary, narrowing, display, and
  legacy reader.
- `core/knowledge-fact.test.ts` — 15 tests.

**Changed**
- `ObservationRecorded` → `KnowledgeFactRecorded`; `Hold.observations` →
  `Hold.facts`.
- Facts reach the surface already formatted by the owning department. The desk
  carries no `type` and no `value`, so no screen can switch on a vocabulary.
- Finance inferences carry confidence below 1, as the confidence rule requires.
- Recording a fact no longer advances a work order.

**Removed**
- Every prose serializer, and the regex readers that parsed them back:
  `name · qty · amount`, `X · 소진`, `선호 · X`, `[관찰]/[추론]` prefixes on
  facts. What survives is one legacy reader per department, reached only for
  pre-migration data.

**Migration** — legacy events keep their prose verbatim as an `unstructured`
value and their author as `unattributed`. Nothing on disk is rewritten, and an
author is never inferred from the envelope's actor.

**Tests** — 100 total, 97 passing.

---

## Constitution

Article 10 (Memory and Provenance) was amended in Phase 1's documentation pass
to require **four** fields rather than three: source, author, acquisition time,
and confidence. It now states that source and author are different questions,
that neither may be substituted for the event's actor, and that an unknown
author is recorded as unattributed and never back-filled.

No other article changed.
