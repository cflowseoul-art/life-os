# Visual Migration — Step 3.1 (dependency backfill)

Copies the five files that blocked `DeskGrid.tsx` and `CityWindow.tsx` in Step 3.
Nothing rendered, no workflow connected, no adapter/gameStore/component edits.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Copied

Into `frontend/src/components/life-office/game/`:

```
DeskMarquee.tsx
MarqueeText.tsx
city/timeUtils.ts
city/skyRenderer.ts
city/buildingRenderer.ts
```

`city/` was created as a subdirectory, matching the source layout so the existing
`./city/...` imports in `CityWindow.tsx` resolve without touching that file.

## Import path fixes: none needed

All five files import only from `react`, `pixi.js`, or their own siblings:

- `DeskMarquee.tsx` → `./MarqueeText`
- `MarqueeText.tsx` → react, pixi.js only
- `city/timeUtils.ts` → no imports
- `city/skyRenderer.ts` → `./timeUtils`
- `city/buildingRenderer.ts` → `./timeUtils`, `./skyRenderer`

Zero `@/` references, so nothing was rewritten. All five are byte-identical to source.

## Effect on Step 3's blocked files

| File | Before | Now |
|---|---|---|
| `DeskGrid.tsx` | blocked on `./DeskMarquee` | **unblocked** — no remaining unresolved imports |
| `CityWindow.tsx` | blocked on `./city/*` **and** `@/stores/gameStore` | **partially unblocked** — `city/*` resolves; still needs `useGameStore`, `selectDebugMode`, `selectSessionId` |
| `Elevator.tsx` | blocked on `./AgentSprite`, `AgentAnimationState` | **unchanged** — still blocked, both out of scope here |

Copy-ready count moves from 4 of 7 to 5 of 7 (`DeskGrid` joins the resolved set).

## Future Improvements

Recorded only, not acted on.

1. **`CityWindow.tsx` needs three gameStore exports** the adapter does not have:
   `useGameStore` (name matches, shape unverified), `selectDebugMode`, `selectSessionId`.
   `selectSessionId` is Claude-session-specific and likely wants a stub returning a constant.
   Blocked here by "do not change gameStore".
2. **`Elevator.tsx` remains the only hard blocker**, and it is blocked on `AgentSprite.tsx`,
   which every task so far has excluded. It cannot be unblocked by more backfill copying —
   it needs `AgentSprite` plus the `Map<string, AgentAnimationState>` gameStore correction
   already recorded in Step 3.
3. The dependency-graph-ordering point from Step 3 stands and was borne out here: this step
   cost one copy command and zero edits precisely because the leaves were copied first.

## Next

Not started.
