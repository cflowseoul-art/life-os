# Visual Migration — Step 3 (first component copy)

Seven components copied verbatim into `frontend/src/components/life-office/game/`.
Import paths rewritten; **no rendering behaviour touched**, no visuals simplified, nothing
rendered, no workflow connected. `OfficeGame.tsx` and `AgentSprite.tsx` not copied.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Fully resolved — 4 of 7

| File | Import rewrites |
|---|---|
| `OfficeBackground.tsx` | `@/constants/canvas` → `../adapter/constants` |
| `LoadingScreen.tsx` | `@/constants/canvas` → `../adapter/constants`; `@/hooks/useTranslation` → `../adapter/stubs` |
| `DigitalClock.tsx` | `@/stores/preferencesStore` → `../adapter/stubs` (type `ClockFormat`) |
| `WallClock.tsx` | `@/stores/preferencesStore` → `../adapter/stubs` |

## Blocked — 3 of 7

These compiled fine in Claude Office but pull in files **outside the copy list I was given**.
I did not copy them and did not stub them, because either choice would exceed the task.

| File | Unresolved | Why blocked |
|---|---|---|
| `DeskGrid.tsx` | `./DeskMarquee` | Not in the copy list. Plan §1a includes it; this step's list does not. |
| `Elevator.tsx` | `./AgentSprite`, `AgentAnimationState` from `@/stores/gameStore` | `AgentSprite.tsx` is **explicitly forbidden** by this task. `ELEVATOR_POSITION` was resolved to `../adapter/constants`. |
| `CityWindow.tsx` | `./city/timeUtils`, `./city/skyRenderer`, `./city/buildingRenderer`, plus `useGameStore` / `selectDebugMode` / `selectSessionId` from `@/stores/gameStore` | The three `city/` modules (593 lines) are plan §1b, not in this step's list. |

Net: 4 files compile-ready against the adapter, 3 files parked with dangling imports.
They are on disk and unmodified apart from the one path fix noted above.

## Adapter changes required by real imports

Step 2's adapter was inferred. Contact with the real files forced two additions:

- `adapter/constants.ts` — added `CANVAS_WIDTH` / `CANVAS_HEIGHT` named exports.
  `OfficeBackground` and `LoadingScreen` import them individually, not as `CANVAS.width`.
- `adapter/stubs.ts` — `usePreferencesStore` was missing everything `WallClock` reads.
  Added `clockType`, `clockFormat`, `cycleClockMode`, and exported `ClockFormat` / `ClockType`.
  The cycle order (analog → digital 24h → digital 12h → analog) is a **guess**; the original
  `preferencesStore` was not readable.

## Step 2 assumption now known wrong

`Elevator.tsx` types its agents as `Map<string, AgentAnimationState>`.

Step 2's `gameStore.ts` uses `Record<AgentId, AgentVisualState>` with a 5-member union —
both the container type and the state type name are wrong. Step 2 flagged this as a risk;
it is now confirmed. `gameStore.ts` will need a `Map`-keyed shape and an `AgentAnimationState`
export before `Elevator.tsx` or any agent-bearing component can resolve.

## Future Improvements

Recorded, not acted on, per the task's stop rule.

1. **Copy order should follow the dependency graph, not the file list.** `DeskGrid`,
   `Elevator`, and `CityWindow` are leaves that depend on files scheduled later. Copying
   `DeskMarquee` + `MarqueeText` + `city/*` first would have made this step 7-for-7 instead
   of 4-for-3. Suggested next batch: `city/timeUtils`, `city/skyRenderer`,
   `city/buildingRenderer`, `DeskMarquee`, `MarqueeText`.
2. **`adapter/stubs.ts` is becoming a grab-bag.** Once the preferences surface is known in
   full it is probably worth splitting `stubs.ts` into `preferencesStore.ts` +
   `stubs.ts`, so a real store can replace one without touching the other.
3. **Reading the source `@/stores/gameStore` and `@/constants/canvas` would end the
   guessing.** Two adapter corrections were needed in this step alone, and each one is only
   discovered by copying more files. The read restriction is costing more than it saves.

## Next

Not started. Either unblock the three parked files with the dependency batch above, or
proceed to the next planned copy group.
