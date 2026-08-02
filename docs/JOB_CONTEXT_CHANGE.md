# Job Context — change note

Adds explicit job input (company / role / pasted JD) as a precondition for the Life Office
mock workflow. No parsing, no API calls, no new stages or employees.

## Changed files

| File | Change |
|---|---|
| `frontend/src/components/life-office/types.ts` | New `JobContext { company, role, jdText }`. `WorkflowState.jobContext` added. `WORKFLOW_STARTED` now carries `jobContext`. |
| `frontend/src/components/life-office/workflow.ts` | New `EMPTY_JOB_CONTEXT` + `isJobContextValid()` (all three fields non-blank; JD presence only). `createInitialState()` seeds an empty context. `WORKFLOW_STARTED` rejects an invalid context with a `warn` log and returns state unchanged. Valid start stores the context and logs `회사 / 직무`. |
| `frontend/src/pages/LifeOfficeDemo.tsx` | Input panel (company, role, JD textarea) held in local draft state. Start button disabled until valid. Header shows `대상 공고: {company} · {role}`, or `미지정` before start. |
| `frontend/src/components/life-office/useWorkflowEngine.ts` | **Outside the listed files** — `start` had no parameter, so the page could not pass a context. Signature changed to `start(jobContext)`. Two lines. |
| `frontend/src/components/life-office/life-office.css` | Appended `.lo-job-inputs` / `.lo-field` rules for the new panel. Existing rules untouched. |

## Behaviour

- Empty or blank-in-any-field context → workflow does not start; a warn entry is logged and
  every employee stays `waiting`.
- 김리서치 (`research`) enters `walking` → `working` only via `enterStage(fresh, 0)`, which is
  now reachable only past the `isJobContextValid` gate.
- Gate is enforced in the reducer, not only in the UI, so a disabled button is not the only
  thing standing between an empty form and a running workflow.
- `WORKFLOW_RESET` clears the stored context; the page's draft input is kept so the user can
  re-run the same job.

## Not done (per scope)

JD parsing, API calls, new stages/employees, visual-migration changes. Application submission
remains manual — the existing approval gate is unchanged.

## Unverified

No tests, lint, typecheck, or browser check were run (excluded by the task). The reducer gate
and the page wiring are unexercised.
