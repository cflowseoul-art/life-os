# Visual Migration — Step 6B (pathfinding systems)

Five movement/pathfinding modules copied verbatim into
`frontend/src/components/life-office/systems/`. Import paths fixed only. `animationSystem` and
the state machines not copied, `OfficeGame` not modified, no workflow connected, nothing
rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Copied

```
astar.ts            (317)
navigationGrid.ts   (463)
pathfinding.ts      (118)
pathSmoothing.ts    (337)
agentCollision.ts   (259)
```

All five are byte-identical to source apart from their import lines. No movement, smoothing,
or collision logic was touched.

## Import rewrites

| Original | Now | Files |
|---|---|---|
| `Position` from `@/types` | `../adapter/types` | all 5 |
| `AgentPhase` from `@/stores/gameStore` | `../adapter/types` | `pathfinding.ts` |

`AgentPhase` was pointed at `../adapter/types` because that is where the adapter defines it —
`adapter/gameStore.ts` re-exports only `AgentAnimationState`.

Intra-directory imports (`./navigationGrid`, `./astar`, `./pathSmoothing`, `./pathfinding`,
`./queuePositions`) all resolve as-is — the copied files sit in the same relative layout as
the source, and `queuePositions.ts` arrived in Step 6A.

**No `@/` references remain in any of the five files.**

## One missing type

`pathfinding.ts:8` imports `AgentState` alongside `Position`. The adapter does not define it.

It is used at line 19 in a single union:

```ts
export function getMovementType(phase: AgentPhase | AgentState): string
```

with the comment "Accepts both frontend AgentPhase and backend AgentState." Since Life Office
has no backend agent states, this will likely resolve to a stub or an alias — but adding a
type is not an import-path fix, so it was left for the next step.

## Canvas height confirmed — 1024, not 720

`navigationGrid.ts:12-14` states the real grid outright:

```ts
export const TILE_SIZE = 32;
export const GRID_WIDTH = 40;   // 1280 / 32
export const GRID_HEIGHT = 32;  // 1024 / 32
```

So the office is **1280 × 1024**. `adapter/constants.ts` guessed `1280 × 720` — width right,
height short by 304 px. This corroborates Step 6A's elevator finding (`y: 178` real vs
`y: 620` invented) and explains it: the invented canvas was too short to place anything
correctly on the vertical axis, and `queuePositions.ts` runs to `y: 900`, which does not even
fit inside the guessed height.

`TILE_SIZE = 32` does match the adapter's guess.

Concretely, `CANVAS_HEIGHT` in `adapter/constants.ts` is now known-wrong and is imported by
`OfficeBackground.tsx` and `LoadingScreen.tsx`. Correcting it to `1024` is a one-line change,
but it sits outside this step's scope.

## Future Improvements

Recorded only, not acted on.

1. **Set `CANVAS_HEIGHT` to 1024** in `adapter/constants.ts`. It is now a recovered value, not
   a guess, and two already-resolved components consume it.
2. **The Step 6A recommendation stands and strengthens**: copy `constants/positions.ts` and
   `constants/canvas.ts` from source rather than reconstructing. Two independent files have
   now contradicted the invented coordinates.
3. `navigationGrid.ts` builds its static obstacle grid from desk/prop positions; once the real
   `constants/positions.ts` lands, the grid will change shape. Any coordinate reconciliation
   should happen before movement is exercised, not after.
4. `DebugOverlays.tsx:18` imports `getObstacleTiles` and `TileType` from
   `@/systems/navigationGrid` — that file now exists locally, so one path fix closes it.
   Not in this step's modify list.
5. `pathfinding.ts:117-118` re-exports `getNavigationGrid`, `resetNavigationGrid`, `TILE_SIZE`,
   `GRID_WIDTH`, `GRID_HEIGHT`, `TileType`. Consumers can import from either module; worth
   picking one convention when the machines land.

## Status

Six files in `systems/`. Five fully resolved; `queuePositions.ts` still needs `DESKS_PER_ROW`
(Step 6A), `pathfinding.ts` still needs `AgentState`.

## Next

Not started.
