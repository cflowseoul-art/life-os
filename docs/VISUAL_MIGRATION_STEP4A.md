# Visual Migration — Step 4A (AgentSprite + shared draw helpers)

Four files copied verbatim, import paths rewritten to the adapter. No behaviour or visuals
changed. `BossSprite` and `OfficeGame` not copied, no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Copied

Into `frontend/src/components/life-office/game/`:

```
AgentSprite.tsx
shared/drawArm.ts      (no @/ imports — byte-identical)
shared/drawBubble.ts   (no @/ imports — byte-identical)
shared/iconMap.ts      (no imports at all — byte-identical)
```

`shared/` created as a subdirectory so `AgentSprite.tsx`'s existing `./shared/...` imports
resolve untouched. Only `AgentSprite.tsx` needed edits, and only on its import lines.

## Import rewrites — `AgentSprite.tsx`

| Original | Now | Resolves? |
|---|---|---|
| `Position`, `BubbleContent` from `@/types` | `../adapter/types` | yes |
| `AgentPhase` from `@/stores/gameStore` | `../adapter/types` | yes |
| `truncateBubbleText` from `@/utils/bubbleText` | `../adapter/stubs` | yes |
| `useAttentionStore` from `@/stores/attentionStore` | `../adapter/stubs` | **partially — see below** |
| `usePreferencesStore` from `@/stores/preferencesStore` | `../adapter/stubs` | **partially — see below** |
| `isInElevatorZone` from `@/systems/queuePositions` | `../adapter/constants` | **no — see below** |

`AgentPhase` was pointed at `../adapter/types` rather than `../adapter/gameStore`, because
that is where the adapter actually defines it; `gameStore.ts` re-exports only
`AgentAnimationState`.

## Three gaps this step could not close

Scope was "fix import paths only", so no adapter file was modified. Each of these needs one
small addition to the adapter:

1. **`isInElevatorZone` does not exist anywhere in the adapter.**
   `adapter/constants.ts` has `ELEVATOR_POSITION` but no zone-test function. The import now
   points at `../adapter/constants`, which is where it belongs, but the symbol is missing.
   Used at `AgentSprite.tsx:229` and `:247` to suppress the name label and speech bubble
   while an agent is inside the elevator. In the source it lived in `systems/queuePositions.ts`,
   which has not been copied.

2. **`usePreferencesStore` is missing `clickToFocusEnabled`** (`AgentSprite.tsx:183`).

3. **`useAttentionStore` is missing `openFocusPopup`** (`AgentSprite.tsx:184`).
   The Step 2 stub exposes only `attention: []`.

Gaps 2 and 3 both feed the click-to-focus interaction, which is inert in Life Office anyway —
a `false` flag and a no-op function are the natural stubs.

## Useful finding: the AgentPhase risk is smaller than flagged

Steps 2, 3.2 and 3.3 all warned that guessed `AgentPhase` member names could fail silently
inside `AgentSprite.tsx`. Reading the file, that risk is largely absent: `phase` appears only
as a prop type (line 33) and is immediately discarded at line 175 as `phase: _phase`. The
component never switches on it. Whatever the correct member names are, `AgentSprite` does not
branch on them — so a mismatch would surface in `animationSystem.ts` (not yet copied), not here.

## Future Improvements

Recorded only, not acted on.

1. The three gaps above are the minimum next edit: add `isInElevatorZone` to
   `adapter/constants.ts`, `clickToFocusEnabled: false` to the preferences stub, and
   `openFocusPopup: () => {}` to the attention stub.
2. `AgentSprite.tsx` now has three separate imports from `../adapter/stubs` on lines 15, 16
   and 21. Correct, but an `adapter/index.ts` barrel would collapse these.
3. `phase: _phase` being unused suggests the source may have moved phase-driven posing into
   `animationSystem.ts`. Worth confirming when that file is copied, since it affects where
   walking/working poses actually come from.

## Status

`Elevator.tsx`'s `./AgentSprite` import now resolves — the Step 3 batch is **7 of 7** on
that blocker. `AgentSprite.tsx` itself is not yet fully resolved, pending the three gaps.

## Next

Not started.
