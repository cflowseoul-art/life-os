# Visual Migration — coordinate recovery

Every canvas and position constant is now copied verbatim from the Claude Office source.
No component logic changed, no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## `adapter/constants.ts` — rewritten from source

### Canvas (from `constants/canvas.ts`)

| Constant | Was (guessed) | Now (source) |
|---|---|---|
| `CANVAS_WIDTH` | 1280 | **1280** — the one guess that was right |
| `CANVAS_HEIGHT` | 720 | **1024** |
| `BACKGROUND_COLOR` | `0x1a1a1f` (as `CANVAS.backgroundColor`) | **`0x1a1a1a`** |

The `CANVAS` wrapper object was removed; the source exports three flat constants and
`OfficeGame.tsx` imports them individually.

### Positions (from `constants/positions.ts`) — all 14, verbatim

```
EMPLOYEE_OF_MONTH_POSITION  { x: 184,  y: 50  }
CITY_WINDOW_POSITION        { x: 319,  y: 30  }
SAFETY_SIGN_POSITION        { x: 1120, y: 40  }
WALL_CLOCK_POSITION         { x: 581,  y: 80  }
WALL_OUTLET_POSITION        { x: 581,  y: 209 }
WHITEBOARD_POSITION         { x: 641,  y: 11  }
WATER_COOLER_POSITION       { x: 1010, y: 200 }
COFFEE_MACHINE_POSITION     { x: 1081, y: 191 }
PRINTER_STATION_POSITION    { x: 50,   y: 945 }
PLANT_POSITION              { x: 118,  y: 970 }
BOSS_RUG_POSITION           { x: 640,  y: 940 }
TRASH_CAN_OFFSET            { x: 110,  y: 65  }
DESKS_PER_ROW               4
MIN_DESK_COUNT              8
```

Source comments preserved, including the note that `DESKS_PER_ROW` / `MIN_DESK_COUNT` must
stay in sync with the backend `state_machine.py`.

### Guessed constants deleted

`DESK_SEAT_OFFSET`, `WORK_ZONE`, `REPORT_ZONE`, `COFFEE_ZONE`, `PRINTER_POSITION`,
`TRASH_POSITION`, and the `CANVAS` object are gone. Verified by grep that nothing imported
them — the old DOM layer (`layout.ts`, `OfficeFloor.tsx`, `useOfficeAnimation.ts`) has its own
`WORK_ZONE` / `REPORT_ZONE` / `COFFEE_ZONE` from `./layout`, unrelated to these and untouched.

How wrong they were, where a source counterpart exists:

| Guessed | Real equivalent |
|---|---|
| `WHITEBOARD_POSITION { 640, 64 }` | `{ 641, 11 }` — x within 1 px, y off by 53 |
| `PRINTER_POSITION { 900, 620 }` | `PRINTER_STATION_POSITION { 50, 945 }` — wrong corner entirely |
| `COFFEE_ZONE { 1080, 160 }` | `COFFEE_MACHINE_POSITION { 1081, 191 }` — x within 1 px, y off by 31 |
| `TRASH_POSITION { 1180, 620 }` | `TRASH_CAN_OFFSET { 110, 65 }` — not even the same kind of value (offset, not position) |

## Repointed imports

| File | Change |
|---|---|
| `systems/queuePositions.ts:14` | `DESKS_PER_ROW` ← `../adapter/constants` (was `@/constants/positions`) |
| `game/DebugOverlays.tsx:14-17` | `ARRIVAL_QUEUE_POSITIONS`, `DEPARTURE_QUEUE_POSITIONS` ← `../systems/queuePositions` (was `../adapter/constants`, where they never existed) |
| `game/DebugOverlays.tsx:18` | `getObstacleTiles`, `TileType` ← `../systems/navigationGrid` (was `@/systems/navigationGrid`) |

`queuePositions.ts` and `DebugOverlays.tsx` are now both fully resolved. `OfficeGame.tsx` is
the only file left with `@/` imports.

## One guessed coordinate deliberately kept

`DESK_POSITIONS` — the five per-employee seed positions consumed by `adapter/gameStore.ts`.

The source has no equivalent: it derives desks from `getDeskPosition(deskNum)` in
`systems/queuePositions.ts`, which is now available locally. Replacing the map with that
function is the correct fix, but it edits `gameStore.ts`, which was outside this task's
modify list. Deleting it without a replacement would have broken the store.

It is now the **only** invented coordinate left in the adapter, and it is flagged as such in
the file with a comment naming its replacement.

## Future Improvements

Recorded only, not acted on.

1. **Replace `DESK_POSITIONS` with `getDeskPosition()`** in `adapter/gameStore.ts`. Note the
   import direction: `queuePositions.ts` now imports `DESKS_PER_ROW` from `adapter/constants`,
   so having `gameStore.ts` import from `systems/queuePositions` creates an
   adapter→systems→adapter cycle. It resolves in ES modules but is worth structuring
   deliberately — moving `DESKS_PER_ROW` out of the adapter would break it cleanly.
2. `CANVAS_HEIGHT` changing 720 → 1024 alters what `OfficeBackground.tsx` and
   `LoadingScreen.tsx` draw. Both were "resolved" before; they were resolved against a wrong
   number. This is the first change in the migration that alters already-working output.
3. `AgentSprite.tsx:198` hard-codes `rect.width / 1280` with the comment `// CANVAS_WIDTH = 1280`.
   Correct today, but it duplicates the constant rather than importing it.
4. `MIN_DESK_COUNT` is unused so far — it will matter when the desk grid renders more desks
   than there are employees, which is the source's default behaviour with 5 agents and a
   minimum of 8 desks.

## Status

All position and canvas constants recovered exactly. One invented coordinate remains
(`DESK_POSITIONS`), scoped out and flagged. `OfficeGame.tsx` holds the last 10 unresolved
`@/` imports.

## Next

Not started.
