# Visual Migration — Step 3.3 (gameStore import paths)

Path rewrite only. No component logic changed, no adapter files touched, `AgentSprite` not
copied, no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Changes

Both edits are a single string replacement, `"@/stores/gameStore"` → `"../adapter/gameStore"`.

`CityWindow.tsx:12-16`
```ts
import {
  useGameStore,
  selectDebugMode,
  selectSessionId,
} from "../adapter/gameStore";
```

`Elevator.tsx:15`
```ts
import type { AgentAnimationState } from "../adapter/gameStore";
```

No `@/` references remain in either file. Import lists, names, and all component bodies are
untouched.

## Resolution status

| Import | Resolves? |
|---|---|
| `CityWindow` → `useGameStore` | yes |
| `CityWindow` → `selectDebugMode` | yes |
| `CityWindow` → `selectSessionId` | yes |
| `Elevator` → `AgentAnimationState` | **no — see below** |

`CityWindow.tsx` is now fully resolved: `city/*` came in at Step 3.1, and all three store
symbols exist in `adapter/gameStore.ts` as of Step 3.2.

## Known gap created by this step's scope

`adapter/gameStore.ts` **imports** `AgentAnimationState` from `./types` but does not
re-export it, so `Elevator.tsx`'s type import points at a symbol that is not there.

I followed the instruction literally — "replace the `@/stores/gameStore` imports with the
adapter gameStore path" — rather than redirecting this one line to `../adapter/types`, which
would have resolved it. Both fixes were one line; the adapter was off-limits this step and
the alternative target was not the path named in the task, so the gap is reported instead of
silently patched.

Two ways to close it, whichever you prefer:

1. `adapter/gameStore.ts` — add `export type { AgentAnimationState } from "./types";`
   (keeps `Elevator.tsx` as it now stands, mirrors how the source module exported the type).
2. `Elevator.tsx:15` — point the import at `"../adapter/types"` instead.

Option 1 matches the original Claude Office layout, where the type lived in the store module.

## Future Improvements

Recorded only, not acted on.

1. **`Elevator.tsx` is still blocked on `./AgentSprite`**, unchanged since Step 3 and
   unaffected by anything in this step. It is the last hard blocker among the seven Step 3
   components, and it cannot be closed without copying `AgentSprite.tsx`.
2. Once `AgentSprite` lands, the `AgentPhase` member names in `adapter/types.ts` should be
   checked against it — a mismatch there renders a default pose rather than erroring.
3. Component-to-adapter imports are now split across three modules (`constants`, `stubs`,
   `gameStore`). An `adapter/index.ts` barrel would make future path rewrites one target
   instead of three, though it is not needed for anything currently on disk.

## Status after this step

Of the seven components copied in Step 3: **six fully resolved**
(`OfficeBackground`, `LoadingScreen`, `DigitalClock`, `WallClock`, `DeskGrid`, `CityWindow`),
one parked (`Elevator`).

## Next

Not started.
