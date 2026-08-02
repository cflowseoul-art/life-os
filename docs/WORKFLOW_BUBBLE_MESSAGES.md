# Workflow Bubble Messages

One file changed: `adapter/workflowBridge.ts`. `workflow.ts`, `useWorkflowEngine.ts`, and
`gameStore.ts` were read but not modified — no workflow order, timing, employee, movement,
coffee, approval, or report logic was touched.

## What was wrong

The bridge spoke one generic line for every phase of every stage:

```ts
s.setAgentBubble(activeId, { text: phaseLabel(activeStage.id), type: "thought" });
```

`phaseLabel` returned `stage.title` — "채용공고 수집", "역량 갭 분석" — so the bubble said the
same thing while walking, working, and reviewing, and said nothing about progress.

## What it says now

`STAGE_LINES`, a stage → phase → string table. `walking` is the stage start, `working` and
`reviewing` are intermediate milestones, `done` is completion. A phase absent from the table
shows no bubble at all, so silence is the default rather than a filler line.

| Stage (assignee) | start | working | reviewing | done |
|---|---|---|---|---|
| collect-jd (김리서치) | 채용공고를 살펴보고 있습니다. | 필수 요건을 정리하고 있습니다. | 핵심 요건을 다시 확인합니다. | 핵심 요건 5개를 찾았습니다. |
| gap-analysis (박분석) | 관련 경험을 대조하고 있습니다. | 경험과 요건을 맞춰보고 있습니다. | 우선순위를 다시 살펴봅니다. | 활용할 경험 3개를 골랐습니다. |
| draft-resume (이작성) | 강조 순서를 정리하고 있습니다. | 이력서 초안을 작성하고 있습니다. | 문장을 다듬고 있습니다. | 초안 작성을 마쳤습니다. |
| fact-check (최검수) | 근거와 표현을 대조하고 있습니다. | 숫자와 사실을 확인하고 있습니다. | 표현을 최종 점검합니다. | 검증을 마쳤습니다. |

Boss lines: approval → `대표님 승인이 필요합니다.`, rejected → `수정 요청을 반영하겠습니다.`,
report ready → `대표님, 검토본이 준비됐습니다.`

Longest line is 17 Korean characters, well under the 28 limit.

## Three behavioural changes this required

1. **Completion messages now survive.** The `done` branch previously called
   `setAgentBubble(activeId, null)` immediately, so a stage-complete line would have been set
   and erased in the same effect. That clear was removed; the store's existing expiry timer
   (Step 1) retires the bubble instead. No new timer was added.
2. **The boss no longer speaks reducer strings.** `approval.action`, `stopReason`, and `report`
   are free-form and can run long — `state.report` in particular is the report body. All three
   were replaced with the fixed lines above, which is also what keeps raw output off screen.
   `REPORT_MESSAGE` is no longer imported; the constant is untouched in `workflow.ts` and still
   used there.
3. **Assignee falls silent during approval.** When `state.approval` is set, the employee bubble
   is suppressed so the approval request is spoken once, by the boss, rather than twice.

## Assumptions

The style examples name 박매칭 / 최전략 / 정검토, but the actual employees are
research/analysis/draft/review/manager (박분석 / 최검수 in `gameStore`). Employees were listed
as not-to-change, so I mapped the *style* onto the existing five rather than renaming anyone —
e.g. the 박매칭 matching lines went to `gap-analysis` (박분석), the 최전략 ordering line to
`draft-resume`. If the intent was actually to rename the team, that is a separate change.

The "5개" and "3개" counts are literal, copied from the examples. The mock reducer produces no
such counts, so they are decorative and will not match real output when a backend drives this.

## Not verified

Nothing was run — tests, lint, typecheck, and browser automation were all excluded. Unverified:
that every phase string in the table matches what the reducer actually emits. The keys come
from `workflow.ts`'s own phase labels (`walking` / `working` / `reviewing` / `done`, lines
262-264, 409) and stage ids (lines 55-86), but a mismatch would show as a missing bubble, not
an error.

## Future Improvements

1. **The counts are fake.** "핵심 요건 5개", "활용할 경험 3개" are hardcoded. Once the resume
   runtime returns real counts, these lines should interpolate them or drop the number.
2. **`STAGE_LINES` lives in the adapter, keyed by stage id.** Copy for a stage is arguably part
   of the stage definition in `workflow.ts`. Keeping it in the bridge honours "do not change
   workflow", but it means adding a stage requires edits in two files.
3. **Milestones are phases, not real progress.** "meaningful intermediate milestone" is
   currently just `working` / `reviewing`, because those are the only intermediate signals the
   mock reducer emits. Real milestones need events the workflow does not yet produce.
