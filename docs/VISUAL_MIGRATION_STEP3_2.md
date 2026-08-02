# Visual Migration — Step 3.2 (gameStore shape correction)

Reshapes the adapter agent collection to the exact form the copied components consume,
and adds the two selectors `CityWindow.tsx` needs. `AgentSprite` not copied, `CityWindow`
and `Elevator` not modified, no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## What the source actually requires

Read off the two consumers rather than guessed:

`Elevator.tsx`
```
agents: Map<string, AgentAnimationState>
Array.from(agents.values()).filter(...)
agent.id · agent.name · agent.color · agent.number
agent.currentPosition.x / .y · agent.phase · agent.bubble.content · agent.isTyping
```

`CityWindow.tsx`
```
useGameStore(selectDebugMode)   -> boolean
useGameStore(selectSessionId)   -> string   // "None" / "sim_session_123" mean simulation
```

## Changes

### `adapter/types.ts`
`AgentVisualState` **replaced** by `AgentAnimationState`. This is a rename plus a reshape,
not an addition — the Step 2 type had no consumer, so nothing was left pointing at it.

| Step 2 (guessed) | Now (from source) |
|---|---|
| `id: AgentId` | `id: string` |
| `position: Position` | `currentPosition: Position` |
| `target: Position \| null` | `targetPosition: Position \| null` |
| `bubble: BubbleContent \| null` | `bubble: { content: BubbleContent \| null }` |
| `deskId`, `facing` | dropped — no consumer |
| — | `color: number` added |
| — | `number: number` added |
| — | `isTyping: boolean` added |

`Position`, `AgentId`, `AGENT_IDS`, `AgentPhase`, `BubbleContent` unchanged.

### `adapter/gameStore.ts`
- `agents` is now `Map<string, AgentAnimationState>`, not `Record<AgentId, …>`.
  Setters key by `string` and no-op on unknown ids. `patch` copies the Map so zustand
  sees a new reference.
- Still the same five hard-coded employees, still all `phase: "idle"` at their desks.
  Added `color` (per-employee tint) and `number` (1–5) since the shape now demands them.
- Added `debugMode: false` and `sessionId: "None"` state.
- Added `selectDebugMode` and `selectSessionId`. No other selectors — nothing else asked.

## Status

`CityWindow.tsx` and `Elevator.tsx` now have an adapter that *matches* them by shape.
Neither file compiles yet, for a reason outside this step's scope — see below.

## Future Improvements

Recorded only, not acted on.

1. **The import paths in both files still point at `@/stores/gameStore`, which does not
   exist in this repo.** The `@/*` alias resolves to `frontend/src/*`, so that path means
   `src/stores/gameStore` — there is no such file, and this step was scoped to modify only
   the two adapter files. Two ways to close it, neither done here:
   (a) rewrite the imports in `CityWindow.tsx` / `Elevator.tsx` to `../adapter/gameStore`
   (matches how Step 3 handled the other four files), or
   (b) add a re-export shim at `src/stores/gameStore.ts`.
   Option (a) is consistent with what is already on disk.
2. `Elevator.tsx` remains blocked on `./AgentSprite` regardless of the store shape.
3. `sessionId: "None"` deliberately puts `CityWindow` on its simulation path, so the sky
   seed comes from the date rather than a session hash. If a stable non-simulation sky is
   wanted later, this is the one value to change.
4. `AgentPhase` member names are still unverified — `AgentSprite.tsx` is the authority and
   has not been read. A mismatch there fails silently (default pose), not loudly.

## Next

Not started.
