# Visual Migration — Step 6A (real queuePositions)

`systems/queuePositions.ts` copied from source; the three consumers repointed at it; the
temporary adapter reimplementations deleted. No other system copied, no workflow connected,
nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Copied

`frontend/src/components/life-office/systems/queuePositions.ts` (242 lines, verbatim).
New `systems/` directory, sibling to `game/` and `adapter/`.

Exports 22 symbols, including several the migration will need later:
`ELEVATOR_POSITION`, `isInElevatorZone`, `ELEVATOR_ZONE`, `ARRIVAL_QUEUE_POSITIONS`,
`DEPARTURE_QUEUE_POSITIONS`, `BOSS_POSITION`, `BOSS_SLOT_LEFT`/`RIGHT`,
`getDeskPosition`, `getQueuePosition`, `calculateQueueSlots`, `getNextSpawnPosition`,
`reserveElevatorPosition`, `releaseElevatorPosition`.

Its own import of `Position` was repointed to `../adapter/types`.

## Consumers repointed

| File | Change |
|---|---|
| `game/Elevator.tsx:13` | `ELEVATOR_POSITION` ← `../systems/queuePositions` (was `../adapter/constants`) |
| `game/AgentSprite.tsx:17` | `isInElevatorZone` ← `../systems/queuePositions` (was `../adapter/constants`) |
| `game/OfficeGame.tsx:81` | `ELEVATOR_POSITION`, `isInElevatorZone` ← `../systems/queuePositions` (was `@/systems/queuePositions`) |

Import lines only. No component logic touched.

## Adapter duplicates removed

Verified by grep that no file still imports them, then deleted from `adapter/constants.ts`:
`ELEVATOR_POSITION`, `ELEVATOR_ZONE_HALF`, `isInElevatorZone`. A three-line comment marks
where they were and why. Fully replaced, so removal was safe.

## The invented coordinates were badly wrong

This is the substantive finding. My Step 2/4B reimplementations versus the real ones:

| | Invented (Steps 2, 4B) | Real (source) |
|---|---|---|
| `ELEVATOR_POSITION` | `{ x: 96, y: 620 }` | `{ x: 86, y: 178 }` |
| elevator zone | ±48 × ±56 rectangle | `ELEVATOR_ZONE` (separate const, own bounds) |

The y-coordinate is off by **442 px** — not a near miss. The invented office assumed the
elevator sits at the bottom-left; in the real layout it is near the top-left, and the source's
canvas is evidently much taller than the `720` guessed in `adapter/constants.ts` (queue and
boss positions here run to `y: 900`).

Step 4B flagged that `isInElevatorZone` was "reimplemented, not recovered" and that the
consequence was narrow. That was correct about the *function* but wrong about the *scale* of
the coordinate error underneath it. Every remaining invented coordinate in
`adapter/constants.ts` — desks, work zone, report zone, coffee, canvas size — should now be
assumed similarly wrong, not approximately right.

## Still unresolved

`queuePositions.ts:14` imports `DESKS_PER_ROW` from `@/constants/positions`, which does not
exist in this repo. It is one of the 13 missing constants catalogued in Step 5A. Left as `@/`
— creating it is not an import-path fix, and inventing another coordinate is exactly what this
step just demonstrated to be a bad idea.

Used by `getDeskPosition(deskNum)` at line 228.

## Future Improvements

Recorded only, not acted on.

1. **Copy `constants/positions.ts` and `constants/canvas.ts` from source rather than
   reconstructing them.** They were excluded from the plan's copy list because they live
   outside `components/game/`, `systems/`, `machines/`, but the coordinate divergence above
   makes reconstruction untenable — the plan's §1 list should be amended.
2. `DebugOverlays.tsx` still imports `ARRIVAL_QUEUE_POSITIONS` / `DEPARTURE_QUEUE_POSITIONS`
   from `../adapter/constants`, where they do not exist. They *do* exist in the file just
   copied. One import-path fix closes it, but `DebugOverlays` was not in this step's
   modify list.
3. `queuePositions.ts` holds module-level mutable spawn state (`getNextSpawnPosition`,
   `reserveElevatorPosition`, `resetSpawnIndex`). Under Vite HMR this will persist across
   reloads; the source had `hmrCleanup.ts` for exactly this, which is not yet copied.

## Status

`Elevator.tsx` and `AgentSprite.tsx` remain fully resolved, now against real coordinates.
`queuePositions.ts` has one unresolved import. `OfficeGame.tsx` lost one of its 11 unresolved
imports — 10 remain.

## Next

Not started.
