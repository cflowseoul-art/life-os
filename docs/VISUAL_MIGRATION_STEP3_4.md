# Visual Migration — Step 3.4 (AgentAnimationState re-export)

One-line addition to `frontend/src/components/life-office/adapter/gameStore.ts`.
Nothing else modified. `AgentSprite` not copied.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Change

Added above the selectors block:

```ts
// Re-exported so consumers can import the type from the store module, matching
// how the original Claude Office `@/stores/gameStore` exported it.
export type { AgentAnimationState } from "./types";
```

The two-line comment is the only thing beyond the requested export. Everything else in the
file — store shape, seeded agents, setters, `selectDebugMode`, `selectSessionId` — is
untouched.

## Effect

Closes the gap reported in Step 3.3. `Elevator.tsx:15`

```ts
import type { AgentAnimationState } from "../adapter/gameStore";
```

now resolves, with `Elevator.tsx` left exactly as Step 3.3 wrote it.

## Status

`Elevator.tsx` has one unresolved import remaining: `./AgentSprite` (line 14).
That is the only thing standing between the Step 3 batch and 7-of-7 resolved.

Current state of the seven Step 3 components:

| Component | Status |
|---|---|
| `OfficeBackground.tsx` | resolved |
| `LoadingScreen.tsx` | resolved |
| `DigitalClock.tsx` | resolved |
| `WallClock.tsx` | resolved |
| `DeskGrid.tsx` | resolved |
| `CityWindow.tsx` | resolved |
| `Elevator.tsx` | blocked — `./AgentSprite` only |

## Next

Not started. The remaining blocker needs `AgentSprite.tsx`, which every step so far has
excluded.
