# QA Backlog

Open items only. Resolved items are removed, not archived — `CHANGELOG.md`
records what was fixed and when.

**Ids are permanent.** A `QA-nn` always means the same defect for as long as
this file exists, and is never reused after that item is resolved. Gaps in the
sequence are the point: a missing number means resolved, and renumbering would
silently repoint every reference made in a commit message or a review.

Last reviewed: after Step 4.4.

---

## Failing tests

**QA-01 — Three Career tests fail on a four-character filter.**
`core/capabilities/career/index.ts` drops requirement statements shorter than
four characters, so `SQL` never becomes a fact. The fixture posting has three
bullets and yields two, failing `held work survives a process boundary`,
`states only counts that are literally true`, and `re-advancing cannot duplicate
observations, asks, or artifacts` in `core/proof.test.ts`.

Either the filter is wrong (`SQL` is a real requirement) or the tests are. Both
readings are defensible, which is why this has not been patched. Note that this
code path is now only reached by the dormant custody-engine route; the live Job
Fit Analyst does not use it.

**QA-02 — `test/inventory-command-parser.contract.test.ts` collects no suite.**
The file fails to load, so the run reports a failing test file with no failing
test. Unrelated to any recent phase; keeps the suite red.

**QA-03 — Frontend has five `TS6133` unused-variable errors.**
`OfficeGame.tsx` (3) and `LifeOfficeDemo.tsx` (2). Pre-existing and untouched by
recent work, but they mean `tsc -b` in `frontend/` never exits clean.

---

## Correctness

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

**QA-18 — Career's routes are separated by request length.**
`core/company/manifest.ts` bounds the Application Operator's routes at 120
characters, because a posting's 전형 절차 contains `1차 면접` and `최종 합격`
exactly as a person reporting one does. Signal narrowness cannot separate them;
length can, and it is a heuristic. A long instruction or a very short posting
will misroute.

---

## Architecture debt

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

**QA-19 — Career Knowledge is keyed on tools, not capabilities.**
ADR-025 makes business capability the primary unit. Knowledge still records
`skill` facts whose values are tool names, and the Job Fit Analyst matches those
names against a posting. The code satisfies the constraint it was given at the
time and is keyed on the wrong unit; it must be migrated rather than extended.

---

## Provenance

**QA-13 — `INFERENCE_CONFIDENCE = 0.5` is declared, not measured.**
No scale exists for interpretive confidence. The constant is documented as a
stated value rather than a precise-looking invention, but it needs a real scale
before more inference types land.

---

## Reporting

**QA-15 — The posting is pasted back as an attachment.**
`core/desk-api.ts` returns six raw lines of the handed-over text and the screen
renders them uncollapsed. Evidence and progress are correctly collapsed; the
attachment is not. Narrowed since first raised: the Job Fit report no longer
quotes the posting, and an operations answer hands over nothing, so this is now
only about the attachment on a posting hold.

---

## Retired ids

Removed from the list above and kept here only so a reference to a retired id
still resolves. Detail is in `CHANGELOG.md`.

| Id | What it was | Closed by |
|---|---|---|
| QA-04 | Fit percentage was token overlap presented as a decision | Step 3.1 — the analyst compares typed knowledge; an unrecognised posting is unscored rather than 0% |
| QA-07 | Career's runner executed three responsibilities | Step 3.1 — strategy and résumé editing removed from `career.job_fit` |
| QA-14 | `derivedFrom` was carried but never populated | Step 3.1 — every fit finding points at the knowledge behind it |
| QA-16 | The report was not shorter than its source | Step 3.1 — asserted against a realistic posting |
| QA-17 | A status question was answered by asking for a posting | Steps 4.1–4.3 — `career.application_operator` answers from the record, and 공고 language is gone from status reports |

**On the numbering.** `QA-17` never sat in this list: it was found during Step
4.1 and fixed in the same stretch of work. It is given an id here because it was
referred to by number in review, and a reference that resolves to nothing is
worse than one that resolves to a retired entry. It is **not** `QA-08`, which is
a different and still-open defect about holds and Asks.
