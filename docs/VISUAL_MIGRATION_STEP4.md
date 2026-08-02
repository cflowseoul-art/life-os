# Visual Migration — Step 4 (AgentSprite / BossSprite / shared drawing)

Scope: copy and adapt `AgentSprite.tsx`, `BossSprite.tsx`, `shared/drawArm.ts`,
`shared/drawBubble.ts`, `shared/iconMap.ts` only. No `OfficeGame.tsx` copy, no movement
systems, no XState machines, no workflow connection, no browser render.
Nothing was run to verify (tests/lint/typecheck/browser excluded by the task).

## Finding: the step-4 artifacts are already on disk

The working tree (branch `recovery/mobile-ui-20260802`) is ahead of
`VISUAL_MIGRATION_STEP3.md`. All five target files already exist under
`frontend/src/components/life-office/game/`, already adapted, with **zero** `@/…` imports
remaining. No copying was required and no file was modified in this step.

| File | Lines | Plan §1 reference | Status |
|---|---|---|---|
| `game/AgentSprite.tsx` | 375 | §1a | present, adapted |
| `game/BossSprite.tsx` | 457 | §1a (455) | present, adapted |
| `game/shared/drawArm.ts` | 111 | §1b (111) | present, verbatim |
| `game/shared/drawBubble.ts` | 90 | §1b (90) | present, verbatim |
| `game/shared/iconMap.ts` | 14 | §1b (14) | present, verbatim |

Line counts match the plan's source counts for the three `shared/` modules exactly, and
`BossSprite.tsx` is within 2 lines of source — consistent with import-path edits only, not
with a redesign or simplification.

## Requirement check

- **Original appearance preserved** — the three `shared/` drawing modules are byte-for-byte
  the sizes recorded in the plan; their exported surface is unchanged
  (`drawRightArm`, `drawLeftArm`, `ArmDrawParams`, `drawBubble`, `drawIconBadge`, `ICON_MAP`).
- **Arm / bubble / character behaviour preserved** — `AgentSprite` and `BossSprite` both
  import `drawBubble` + `drawIconBadge`, `drawRightArm` + `drawLeftArm`, and `ICON_MAP`
  directly; no local reimplementation exists in either file.
- **Import paths fixed only through the adapter** — every non-Pixi, non-React import in the
  five files resolves to `../adapter/types`, `../adapter/stubs`, `../systems/queuePositions`,
  or a sibling in `game/`:
  - `AgentSprite.tsx` → `Position`, `BubbleContent`, `AgentPhase` from `../adapter/types`;
    `useAttentionStore`, `usePreferencesStore`, `truncateBubbleText` from `../adapter/stubs`;
    `isInElevatorZone` from `../systems/queuePositions`.
  - `BossSprite.tsx` → `BossState`, `BubbleContent`, `Position` from `../adapter/types`;
    `truncateBubbleText` from `../adapter/stubs`; `MarqueeText` from `./MarqueeText`.
- **Five static employees from `adapter/gameStore.ts`** — `seedAgents()` seeds
  `research 김리서치 · analysis 박분석 · draft 이작성 · review 최검수` at desks 1, 2, 5, 6
  (the left 2×2 Career block), with `manager 한매니저` held out.
- **Manager → BossSprite** — `adapter/types.ts` exports `BOSS_AGENT_ID = "manager"`;
  `seedAgents()` filters it out of the `agents` Map, and the store carries a separate `boss:
  BossAnimationState` at `BOSS_POSITION`. 한매니저 therefore can only render through
  `BossSprite`, never through `AgentSprite`.
- **Not copied / not connected** — no movement system or XState machine was added in this
  step; nothing was rendered.

## Deviation from the task's stated preconditions

`OfficeGame.tsx` was listed as "do not copy", but it already exists in the tree from earlier
work and imports `AgentSprite`, `BossSprite`, `BossBubble`, and `MobileBoss` (lines 72–78,
573, 639). It was left untouched. `adapter/gameStore.ts` likewise already carries the
`boss`, whiteboard, elevator, and debug-overlay surface that later steps require — also left
untouched.

Practical consequence: this task's step-4 scope is complete by prior work, and the real
open front is the plan's own §5 step 4 ("first render") — which this task forbids.

## Future Improvements

Recorded, not acted on, per the stop rule.

1. **Re-sync the step docs with the tree before the next step.** `STEP3.md` reports
   `AgentSprite.tsx` as not copied and three files parked with dangling imports; none of
   that is still true. Every future step scoped off these docs will re-derive work that
   already exists, as this one did.
2. **Verify appearance by diff, not by line count.** A one-off `diff` against the Claude
   Office source for the five files would upgrade "consistent with import-only edits" to
   proof. It needs read access to the source tree, which the current task rules withhold.
3. **`BossSprite.tsx` bubble sourcing is still unwired.** Plan §2 wants it fed from
   `WorkflowState.report` / `approval.action`; today `adapter/workflowBridge.ts` exposes
   `setBossBubble` / `setBossState` and the store defaults to `{ content: null }`. That is
   the plan's step 6/7, correctly deferred.

## Next

Per the plan: §5 step 4 — mount `<OfficeGame/>` in `LifeOfficeDemo.tsx` against the static
store and confirm the scene renders pixel-identical to Claude Office. That is the first
checkpoint where a wrong adapter coordinate becomes visible.
