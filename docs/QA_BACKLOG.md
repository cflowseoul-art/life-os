# QA Backlog

Open items only. Resolved items are removed, not archived — `CHANGELOG.md`
records what was fixed and when.

Last reviewed: end of Phase 1.

---

## Failing tests

**QA-01 — Three Career tests fail on a four-character filter.**
`core/capabilities/career/index.ts` drops requirement statements shorter than
four characters, so `SQL` never becomes a fact. The fixture posting has three
bullets and yields two, failing `held work survives a process boundary`,
`states only counts that are literally true`, and `re-advancing cannot duplicate
observations, asks, or artifacts` in `core/proof.test.ts`.

Either the filter is wrong (`SQL` is a real requirement) or the tests are. Both
readings are defensible, which is why this has not been patched. Settle it when
the Job Fit Analyst is rebuilt.

**QA-02 — `test/inventory-command-parser.contract.test.ts` collects no suite.**
The file fails to load, so the run reports a failing test file with no failing
test. Unrelated to any recent phase; keeps the suite red.

**QA-03 — Frontend has five `TS6133` unused-variable errors.**
`OfficeGame.tsx` (3) and `LifeOfficeDemo.tsx` (2). Pre-existing and untouched by
recent work, but they mean `tsc -b` in `frontend/` never exits clean.

---

## Correctness

**QA-04 — Fit percentage is token overlap presented as a decision.**
`core/capabilities/career/fit.ts` scores ≥2 shared tokens as a strong match, 1 as
partial, 0 as a gap. Requirements come only from lines beginning `-`, `*`, or
`•`, capped at seven, so a posting written in prose scores 0% and recommends
보류. The figure appears in the report title and in the Ask.

**QA-05 — Continuation fires on a job-title substring.**
`core/company/continuation.ts` starts 면접 준비 when a completed Career hold's
role contains "디자이너", "시니어 디자이너", or "프로덕트 디자이너". Three
hardcoded titles, in the company layer. It also fires after a *résumé* rather
than after an *application*, and what it starts is a bare `HandedOver` with no
runner invocation — so the new hold has no facts, no Ask, and no artifact, and
sits in 진행 중 permanently.

**QA-06 — Hold and Skip are the same terminal state.**
`core/capabilities/career/runner.ts` writes a closing artifact for both, which
marks the hold `kept`. The copy promises to resume a held posting later; nothing
implements resumption.

---

## Architecture debt

**QA-07 — Career's runner executes three responsibilities.**
It declares `career.fit-analysis` and also performs application strategy and
résumé editing inside `answer()`. Dispatch can address them separately now;
splitting the runner is scheduled work, not an accident.

**QA-08 — A hold does not record which responsibility raised an Ask.**
Answering resolves the capability's accountable responsibility instead. Correct
while each capability has one runner; a stage machine will need the
responsibility on the event.

**QA-09 — Artifact section headings still encode structure as prose.**
Finance writes `[관찰]`, `[근거]`, `[추론]`, `[제안]` into
`ArtifactSection.heading`, and `core/reports/templates.ts` reads them back by
string prefix. Career does the same with `적합도 `, `강한 일치 · `, and others.
This is the pattern `KnowledgeFact` removed from facts, still present on
`Artifact`.

**QA-10 — Career's report structure lives in the shared report module.**
`core/reports/templates.ts` reconstructs Career's sections by parsing headings
the runner wrote. A heading change in the runner silently empties a section in
the template, with no type error.

**QA-11 — A third Career team exists in the frontend as fixtures.**
`frontend/src/components/life-office/workflow.ts` defines `CAREER_TEAM` —
김리서치, 박분석, 이작성, 최검수, 한매니저 — contradicting the real roster. The
office depicts one set of people; reports are signed by another.

**QA-12 — Dead code in the company layer.**
`core/company/treasury-runner.ts` is unreferenced, and
`core/company/asset-runner.ts` is reachable only from it.

---

## Provenance

**QA-13 — `INFERENCE_CONFIDENCE = 0.5` is declared, not measured.**
No scale exists for interpretive confidence. The constant is documented as a
stated value rather than a precise-looking invention, but it needs a real scale
before more inference types land. Blocks nothing; should be settled early in
Phase 2.

**QA-14 — `derivedFrom` is carried but never populated.**
No department derives a fact from other facts yet. The field is typed and tested
and becomes load-bearing when Career Knowledge lands.

---

## Reporting

**QA-15 — The posting is pasted back into the report.**
`core/desk-api.ts` returns six raw lines of the handed-over text and the screen
renders them uncollapsed. Evidence and progress are correctly collapsed; the
attachment is not.

**QA-16 — The report is not shorter than its source.**
Career emits one section per requirement across three match groups, each
carrying the posting's own words, and the report template re-groups them.
