# Visual Migration — Step 5A (OfficeGame copy, unfixed)

`OfficeGame.tsx` (762 lines) copied byte-identical into
`frontend/src/components/life-office/game/`. **No imports fixed**, no adapters or existing
components modified, no workflow connected, nothing mounted or rendered — all as instructed.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

The file does not compile in its current state. That is the expected outcome of this step.

## Unresolved `@/` imports — 11 statements

| Line | Import | Adapter status |
|---|---|---|
| 29 | `performSoftReset`, `getHmrVersion` from `@/systems/hmrCleanup` | not copied |
| 30–45 | 13 symbols from `@/stores/gameStore` | 3 of 13 exist |
| 46 | `useAnimationSystem` from `@/systems/animationSystem` | not copied |
| 47 | `wireGameRuntime`, `unwireGameRuntime` from `@/systems/gameRuntime` | not copied |
| 48 | `useCompactionAnimation` from `@/systems/compactionAnimation` | not copied |
| 49 | `useOfficeTextures` from `@/hooks/useOfficeTextures` | exists at `adapter/useOfficeTextures` |
| 50–54 | `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `BACKGROUND_COLOR` from `@/constants/canvas` | 2 of 3 exist |
| 55–70 | 14 symbols from `@/constants/positions` | 1 of 14 exists |
| 79 | `useNavigationStore` from `@/stores/navigationStore` | exists in `adapter/stubs` |
| 80 | `LOBBY_FLOOR_ID` from `@/types/navigation` | exists in `adapter/stubs` |
| 81 | `ELEVATOR_POSITION`, `isInElevatorZone` from `@/systems/queuePositions` | both exist in `adapter/constants` |

### `@/stores/gameStore` — 13 selectors, 3 present

Present: `useGameStore`, `selectDebugMode`, plus `selectSessionId` (not imported here).

Missing: `selectAgents`, `selectBoss`, `selectTodos`, `selectShowPaths`, `selectShowQueueSlots`,
`selectShowPhaseLabels`, `selectShowObstacles`, `selectElevatorState`,
`selectContextUtilization`, `selectIsCompacting`, `selectPrintReport`.

`selectBoss` is notable — the store has no boss state at all, and the manager is to render as
`BossSprite` only.

### `@/constants/positions` — 14 symbols, 1 present

Present: `WHITEBOARD_POSITION`.

Missing: `EMPLOYEE_OF_MONTH_POSITION`, `CITY_WINDOW_POSITION`, `SAFETY_SIGN_POSITION`,
`WALL_CLOCK_POSITION`, `WALL_OUTLET_POSITION`, `WATER_COOLER_POSITION`,
`COFFEE_MACHINE_POSITION`, `PRINTER_STATION_POSITION`, `PLANT_POSITION`, `BOSS_RUG_POSITION`,
`TRASH_CAN_OFFSET`, `DESKS_PER_ROW`, `MIN_DESK_COUNT`.

`BACKGROUND_COLOR` is missing from `@/constants/canvas` (the adapter has it nested as
`CANVAS.backgroundColor`, not as a named export).

## Unresolved relative imports — 7 components not yet copied

Resolved (already on disk): `AgentSprite`, `BossSprite`, `WallClock`, `CityWindow`,
`Elevator`, `DeskGrid`, `LoadingScreen`, `OfficeBackground`.

**Not copied:** `TrashCanSprite`, `Whiteboard`, `SafetySign`, `EmployeeOfTheMonth`,
`PrinterStation`, `DebugOverlays`, `ZoomControls`.

Two named imports also need checking against files already on disk:
`isAgentInElevator` from `./Elevator`, and `AgentArms` / `AgentHeadset` / `AgentLabel` /
`Bubble as AgentBubble` from `./AgentSprite` — those four are separate exports beyond the
`AgentSprite` component itself.

## Manager renders as BossSprite

Noted, not acted on — `OfficeGame.tsx` was not edited. The file imports `BossSprite`,
`BossBubble`, and `MobileBoss` at line 78 and `AgentSprite` at 72–77, so the decision flagged
in 4C is now concrete: whichever branch draws the manager, the other must not also draw it.
Resolving this is an edit to `OfficeGame.tsx`, which this step forbids.

## Future Improvements

Recorded only, not acted on.

1. **`@/constants/positions` is the largest single gap** — 13 invented coordinates needed, on
   top of the ones already invented in Step 2. Every prop position in the office depends on
   them, and none can be recovered without reading the source `constants/positions.ts`. This
   is the point where the "coordinates are guesses" debt from Step 2 becomes load-bearing.
2. **`systems/*` is now the critical path**: `animationSystem`, `gameRuntime`,
   `compactionAnimation`, `hmrCleanup`, `queuePositions`. Four are entirely absent and
   `OfficeGame` calls hooks from three of them.
3. `wireGameRuntime` / `unwireGameRuntime` (line 47) is the WebSocket wiring the plan marked
   for removal — worth confirming when `gameRuntime.ts` is examined, since the plan excluded
   `webSocketController.ts` but not `gameRuntime.ts`.
4. `MobileBoss` is imported here. Life Office is desktop-only, so this is a candidate for
   removal during the eventual `OfficeGame` adaptation.

## Status

Thirteen components on disk. Twelve fully resolved; `OfficeGame.tsx` unresolved by design.

## Next

Not started.
