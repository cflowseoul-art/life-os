# Job Context — Step 1

One file changed: `pages/LifeOfficeDemo.tsx`. `types.ts`, `workflow.ts`, and
`useWorkflowEngine.ts` were read but **not modified** — the data model and the start gate
already existed and needed nothing.

## Already present — not re-implemented

| Requirement | Where it already lives |
|---|---|
| `JobContext` with `company` / `role` / `jdText` | `types.ts:84-88`, carried on `WorkflowState.jobContext` (`:105`) and `WORKFLOW_STARTED` (`:122`) |
| Cannot start with any field empty | `workflow.ts:124-129` `isJobContextValid` (trims all three), enforced in the reducer at `:237` — the guard is server-side of the UI, not just a disabled button |
| Start carries the context | `useWorkflowEngine.ts:62-63` `start(jobContext)` → `WORKFLOW_STARTED` |
| Empty default | `workflow.ts:114-118` `EMPTY_JOB_CONTEXT` |

The page also already held `draft` state, the field inputs, and `canStart` gating. So the
actual gap was presentational: the inputs lived only in a desktop left overlay and a mobile
bottom sheet, and the button read "워크플로 시작".

## Changed

**Compact input bar above the office** (`lo-jobbar`, rendered immediately after the
`lo-stage-layer` div). One row: 회사, 직무, a one-row JD textarea, and the 분석 시작 button.
Styling is inline flex — `life-office.css` was outside the read list, so no class was invented
that the stylesheet would have to define. The bar wraps on narrow screens.

**Button label** — "워크플로 시작" → "분석 시작", in both the new bar and the existing panel.

**Header job line** — previously showed "공고 미지정" until the workflow started. It now falls
back to the in-progress draft (`회사 미입력 · 직무 미입력` for blanks), so the header reflects
current company and role while typing, not only after start.

Nothing else: no employee, stage order, movement, coffee, bubble, or approval change. No JD
parsing, no API call added — `startRun` is the pre-existing handler and is unchanged.

## 김리서치 starts only on 분석 시작

Unchanged and verified by reading, not running: the only caller of `start()` is `startRun`,
reachable only from a 분석 시작 button, and both are `disabled` unless `canStart`. Even if a
button were enabled wrongly, `workflow.ts:237` rejects an invalid context, so no
`STAGE_PHASE_CHANGED` fires and the bridge never issues 김리서치's path.

## Known duplication

The old inputs in the desktop left overlay (`lo-panel-left`) and the mobile sheet are still
there, so on desktop the same three fields now appear twice — once in the new bar, once in the
left panel. Both write the same `draft` state, so they stay in sync and neither is stale.
Removing the left panel's copy is the obvious follow-up but was not part of "add a compact
input panel", and cutting it would have meant reworking the overlay layout. Flagging rather
than silently deciding.

## Not verified

Nothing was run beyond confirming the module still transforms under Vite (HTTP 200). Tests,
lint, typecheck, and browser automation were all excluded. The bar's appearance — spacing,
whether it overlaps the top bar, how it wraps on mobile — is unobserved.

## Future Improvements

1. **Remove the duplicated fields** in `lo-panel-left` / the mobile sheet, leaving the bar as
   the single input surface.
2. **Inline styles because CSS was off-limits.** `.lo-jobbar` has a class name but no
   stylesheet rule; the layout is inline. Moving it into `life-office.css` alongside the other
   `lo-` classes would match the rest of the page.
3. **`running` is the only disable signal.** The fields stay editable after a run completes,
   so a finished run's context can be edited without visibly resetting anything. Not wrong, but
   worth a decision once re-runs are a real flow.
