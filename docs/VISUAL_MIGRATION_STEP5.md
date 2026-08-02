# Visual Migration — Step 5 (first render)

Goal: render the existing Pixi Life Office scene once in a desktop browser.

**Outcome: blocked on the browser, not on the code.** No file was modified — nothing needed
modifying. The mount already exists and the whole module graph loads clean under Vite.
The one thing the step actually asks for, a visual confirmation, could not be produced.

## The mount already exists

`frontend/src/pages/LifeOfficeDemo.tsx` already renders the existing `OfficeGame`:

```tsx
// line 25
import { OfficeGame } from "../components/life-office/game/OfficeGame";
...
// lines 299-301 — Office is the permanent full-screen background layer
<div className="lo-stage-layer">
  <OfficeGame />
</div>
```

`OfficeGame.tsx` mounts the full original scene — `OfficeBackground`, `DeskGrid`,
`Whiteboard`, `CityWindow`, `WallClock`, `Elevator`, `PrinterStation`, `TrashCanSprite`,
`SafetySign`, `EmployeeOfTheMonth`, `AgentSprite`, `BossSprite`, `ZoomControls`,
`LoadingScreen`, wrapped in `TransformWrapper`. Nothing is stubbed out or simplified.

Store state matches the step's requirement without changes: `adapter/gameStore.ts` seeds four
employees (research/analysis/draft/review at desks 1, 2, 5, 6) plus a separate `boss` at
`BOSS_POSITION`, with 한매니저 held out of the `agents` Map so it can only draw as
`BossSprite`.

## What was verified

Dev server started clean (Vite 8.1.5, `http://localhost:5173/`, ready in 255 ms, no
transform or resolve errors in the log). Every module on the render path returns HTTP 200
from Vite's transform pipeline:

```
/                                                  200
/src/main.tsx                                      200
/src/pages/LifeOfficeDemo.tsx                      200
/src/components/life-office/game/OfficeGame.tsx    200
/src/components/life-office/game/AgentSprite.tsx   200
/src/components/life-office/game/BossSprite.tsx    200
/src/components/life-office/adapter/gameStore.ts   200
```

All six runtime deps are installed (`pixi.js` 8.19.0, `@pixi/react` 8.0.5, `zustand` 5.0.14,
`xstate` 5.32.5, `@xstate/react` 6.1.0, `react-zoom-pan-pinch` 4.0.3) and
`frontend/public/sprites/` is present.

This proves imports resolve and the graph compiles. It does **not** prove the canvas paints —
Pixi failures (texture load, `extend()` registration, `@pixi/react` v8 under Vite) are runtime
and only surface on screen.

## What blocked it

The Chrome extension is not connected:

> Browser extension is not connected. Please ensure the Claude browser extension is installed
> and running (https://claude.ai/chrome), and that you are logged into claude.ai with the same
> account as Claude Code.

Two attempts (`navigate`, then `tabs_context_mcp{createIfEmpty:true}`); stopped there per the
rabbit-hole rule rather than retrying.

**To finish this step:** the dev server is still running in the background on
`http://localhost:5173/` — open it in a desktop browser and confirm the office, boss, and four
employees paint. If the canvas is blank, the console will name the cause; that is the first
error worth fixing under "fix only errors that prevent the scene from rendering."

Note: the plan's own risk list flagged `@pixi/react` 8.0.5 under Vite instead of Next/Turbopack
as an untested combination. That risk is still open — this step was supposed to close it.

## Requirements not exercised

Everything downstream of a working canvas is unverified: original Claude Office visuals
preserved, boss + four employees visible, static scene. No claim is made about any of them.

## Future Improvements

Recorded, not acted on.

1. **Workflow state is already connected, contrary to this step's constraint.**
   `LifeOfficeDemo.tsx:26,66` imports and calls `useWorkflowBridge(state)`, and the page also
   carries `useResumeProgress`, backend run polling, camera presets, and a mobile tab/sheet
   shell. The step says "do not connect workflow state yet"; prior work already did. I did not
   unpick it — removing it would be a refactor and would break the shipped page. Consequence:
   the scene under test is not actually static, so a moving sprite at first render is expected
   behaviour, not a bug.
2. **The step docs keep describing a tree that no longer exists.** Same finding as Step 4:
   Steps 2-3 describe an adapter being guessed at, while the tree has `systems/`, `machines/`,
   `workflowBridge.ts`, and `camera-presets.ts` already in place. Each new step spends its
   budget rediscovering this.
3. **A headless render check would remove the browser-extension dependency.** A one-off
   Playwright script that loads the page, waits for the canvas, and dumps console errors +
   a PNG would make this checkpoint reproducible in CI. It is a new dev dependency, so out of
   scope here.

## Next

Unblock the browser and repeat this step — it is a look, not a change. Then the plan's step 5
(motion) can proceed against a scene known to paint.
