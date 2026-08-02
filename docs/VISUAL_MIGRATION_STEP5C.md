# Visual Migration — Step 5C (remaining scene components + whiteboard)

Seven components and the full `whiteboard/` directory copied verbatim. Import paths rewritten
where an adapter target exists. `OfficeGame.tsx` not modified, no workflow connected, nothing
rendered, nothing simplified or removed.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Copied

Into `frontend/src/components/life-office/game/`:

```
TrashCanSprite.tsx      (366)   no @/ imports — byte-identical
Whiteboard.tsx          (245)
SafetySign.tsx          (101)
EmployeeOfTheMonth.tsx  (138)   no @/ imports — byte-identical
PrinterStation.tsx      (183)   no @/ imports — byte-identical
DebugOverlays.tsx
ZoomControls.tsx         (41)
whiteboard/                     14 files: 12 modes + index.ts + WhiteboardModeRegistry.ts
```

All 14 whiteboard modes carried over intact, including the Claude-flavoured ones
(`StonksMode`, `ToolPizzaMode`, `HeatMapMode`, `OrgChartMode`, `NewsTickerMode`,
`RemoteWorkersMode`). Nothing was dropped.

## Import rewrites

Top-level components → `../adapter/…`; whiteboard modes → `../../adapter/…`.

| Original | Now |
|---|---|
| `@/types` | `adapter/types` |
| `@/stores/gameStore` | `adapter/gameStore` |
| `@/hooks/useTranslation` | `adapter/stubs` |
| `@/systems/queuePositions` | `adapter/constants` |

Three components needed no edits at all (`TrashCanSprite`, `EmployeeOfTheMonth`,
`PrinterStation`) — they import only from `react` / `pixi.js`.

## Unresolved after rewriting

### 1. `@/systems/navigationGrid` — no adapter target

`DebugOverlays.tsx:18` imports `getObstacleTiles` and `TileType`. `navigationGrid.ts` (463
lines) has not been copied and the adapter has no equivalent, so this import was **left
pointing at `@/`**. It is the only remaining `@/` reference in this batch.

### 2. Missing adapter types — 6 symbols

| Symbol | Imported by |
|---|---|
| `WhiteboardData` | 8 whiteboard modes |
| `TodoItem` | `Whiteboard.tsx`, `TodoListMode` |
| `WhiteboardMode` | `Whiteboard.tsx`, `WhiteboardModeRegistry` |
| `Agent` | `Whiteboard.tsx`, `OrgChartMode` |
| `KanbanTask` | `KanbanMode` |
| `BackgroundTask` | `RemoteWorkersMode` |

Paths now point at `adapter/types`, which defines none of them.

### 3. Missing gameStore members — 4

| Symbol | Imported by |
|---|---|
| `selectToolUsesSinceCompaction` | `SafetySign.tsx` |
| `selectAgents` | `DebugOverlays.tsx` |
| `cycleWhiteboardMode` | `Whiteboard.tsx:146` |
| `setWhiteboardMode` | `Whiteboard.tsx:147` |

The last two are store *actions* accessed via `useGameStore((s) => …)`, not selectors — they
need real state on the store, not just an exported function.

### 4. Missing constants — 2

`ARRIVAL_QUEUE_POSITIONS` and `DEPARTURE_QUEUE_POSITIONS`, imported by `DebugOverlays.tsx`
from what is now `adapter/constants`. Both originate in `systems/queuePositions.ts`, uncopied.

None of these were added: this step's scope was "fix import paths only when required", and
each is a new type or store field rather than a path.

## Note on `Agent` vs `AgentAnimationState`

`Whiteboard.tsx:188-189` converts agent animation state into a *different* `Agent` interface
for `OrgChartMode`. So the adapter needs both shapes, not one — `AgentAnimationState` for
rendering and a plainer `Agent` for the org chart. Worth knowing before someone tries to alias
them together.

## Future Improvements

Recorded only, not acted on.

1. **`WhiteboardData` is the single highest-leverage missing type** — 8 of 12 modes import it.
   Its shape is likely recoverable from how the modes destructure it, the same technique that
   recovered `BossState` exactly in 4C.
2. **`systems/` is now unambiguously the blocker.** `navigationGrid` and `queuePositions` are
   both needed by `DebugOverlays` alone; `OfficeGame` needs four more. No further component
   copying will reduce this.
3. `DebugOverlays` is debug-only and gated behind `selectDebugMode`, which the adapter hard-codes
   to `false`. If the systems work proves costly, this is the one component whose gaps could be
   deferred without visual loss.
4. The whiteboard modes are decorative and driven by data Life Office does not produce. They
   will render empty until the bridge supplies `WhiteboardData` — not a defect, but worth
   expecting at first render.

## Status

Twenty components on disk. Twelve fully resolved; `OfficeGame.tsx` plus this batch's
`Whiteboard`, `SafetySign`, `DebugOverlays`, `ZoomControls` and the whiteboard modes await
adapter types and store members.

`ZoomControls.tsx` is fully resolved (only needed `useTranslation`).

## Next

Not started.
