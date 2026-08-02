# MIGRATION_VISUAL_PLAN.md

Replace the Life Office emoji/CSS visual layer with the Claude Office PixiJS visual layer,
keeping Life Office workflow + approval semantics intact.

Status: **plan only — no code modified.**

---

## 0. Blocking finding (read first)

The two frontends are not the same kind of app. This is not a file-copy job.

| | Claude Office (source) | Life OS frontend (target) |
|---|---|---|
| Framework | Next.js 16 (`next dev --turbo`) | Vite 8 + React 19 |
| Rendering | **PixiJS 8 canvas** (`@pixi/react`) | plain DOM + CSS (`life-office.css`, 668 lines) |
| State | `zustand` + `xstate` machines | `useReducer` in `useWorkflowEngine.ts` |
| Pan/zoom | `react-zoom-pan-pinch` | CSS `overflow-x` scroll |
| Path alias | `@/*` | none |
| Assets | `public/sprites/*.png` (30 files) | none |

`frontend/package.json` currently has **only** `react` + `react-dom` as runtime deps. Every
Pixi component copied over will fail to resolve until deps and the `@/*` alias are added.

A `grep` for `@/…` across the three source directories returns the following out-of-scope
modules the visual layer imports (these live outside the four paths I was told to read, so
their contents are **unverified** — counts are import-site counts):

```
 31  @/types                          <- Position, BubbleContent, …   (must be recreated)
 15  @/stores/gameStore               <- agents, phases, positions    (must be recreated)
  4  @/stores/preferencesStore        <- toggles                      (stub)
  4  @/hooks/useTranslation           <- i18n                         (stub -> identity)
  4  @/constants/positions            <- desk/zone coordinates        (must be recreated)
  4  @/constants/canvas               <- canvas size/scale            (must be recreated)
  2  @/utils/bubbleText               <- truncateBubbleText           (must be recreated)
  1  @/hooks/useOfficeTextures        <- sprite PNG loader            (must be recreated)
  1  @/stores/attentionStore          <- attention flags              (stub)
  1  @/stores/navigationStore         <- multi-floor nav              (stub -> single floor)
  1  @/types/navigation               <- LOBBY_FLOOR_ID               (stub)
  1  @/constants/quotes               <- flavour text                 (copy or stub)
  1  @/utils/event-type-styles        <- Claude event colours          (stub)
  1  @/components/command/useCommandCenterPeers  <- Claude-specific    (stub -> [])
  1  @/components/command/layout                 <- Claude-specific    (stub)
```

`@/hooks/useOfficeTextures` is a **hook**, and hooks were listed as "do not copy". It is
nevertheless required to load `public/sprites/*.png` — the office is invisible without it.
Assumption taken: the "no hooks" rule targets *auth/data/WebSocket* hooks, not the texture
loader. It is listed below under adapters (rewrite, ~30 lines) rather than under copies, so
no Claude-specific hook is imported verbatim.

---

## 1. Exact files to copy (verbatim)

Destination root: `frontend/src/components/life-office/`

### 1a. Pixi scene components → `life-office/game/`
```
components/game/OfficeGame.tsx            (762)  * see §2, heaviest adapt
components/game/AgentSprite.tsx                  * see §2
components/game/BossSprite.tsx            (455)
components/game/OfficeBackground.tsx      (119)
components/game/DeskGrid.tsx
components/game/DeskMarquee.tsx
components/game/MarqueeText.tsx           (164)
components/game/Elevator.tsx              (172)
components/game/WallClock.tsx             (103)
components/game/DigitalClock.tsx          (118)
components/game/Whiteboard.tsx            (245)
components/game/SafetySign.tsx            (101)
components/game/CityWindow.tsx
components/game/EmployeeOfTheMonth.tsx    (138)
components/game/PrinterStation.tsx        (183)
components/game/TrashCanSprite.tsx        (366)
components/game/ZoomControls.tsx           (41)
components/game/LoadingScreen.tsx          (56)
components/game/DebugOverlays.tsx
```

### 1b. Sub-directories → `life-office/game/`
```
components/game/shared/iconMap.ts          (14)
components/game/shared/drawBubble.ts       (90)   <- speech bubbles
components/game/shared/drawArm.ts         (111)
components/game/city/timeUtils.ts         (124)
components/game/city/skyRenderer.ts       (280)
components/game/city/buildingRenderer.ts  (189)
components/game/whiteboard/*.tsx  (14 modes + index.ts + WhiteboardModeRegistry.ts)
```
Whiteboard modes stay in full — "do not simplify the visuals". Claude-flavoured modes
(`StonksMode`, `ToolPizzaMode`, `HeatMapMode`, `OrgChartMode`, `NewsTickerMode`,
`RemoteWorkersMode`) render as decoration fed by the adapter; `CoffeeMode`, `TodoListMode`,
`KanbanMode`, `TimelineMode`, `SafetyBoardMode`, `WeatherMode` get real Life Office data.

### 1c. Motion / pathing systems → `life-office/systems/`
```
systems/astar.ts                (317)
systems/navigationGrid.ts       (463)
systems/pathfinding.ts          (118)
systems/pathSmoothing.ts        (337)
systems/queuePositions.ts       (242)   <- also exports ELEVATOR_POSITION
systems/agentCollision.ts       (259)
systems/animationSystem.ts      (489)   <- the walk/idle tick loop
systems/compactionAnimation.ts  (344)
systems/exitAnimation.ts        (137)
systems/exitAnimation.test.ts    (36)
systems/commandCenterGrid.ts    (119)
systems/commandCenterMotion.ts  (188)
systems/gameRuntime.ts           (29)
systems/hmrCleanup.ts            (91)
systems/stateReconciler.ts      (289)   * see §2
```

### 1d. XState machines → `life-office/machines/`
```
machines/positionHelpers.ts      (100)
machines/agentMachineCommon.ts   (426)
machines/agentMachine.ts         (443)
machines/agentArrivalMachine.ts   (40)
machines/agentDepartureMachine.ts (49)
machines/queueManager.ts         (193)
machines/agentMachineService.ts  (667)  * see §2
```

### 1e. Assets → `frontend/public/sprites/`
All 30 PNGs verbatim: `desk.png`, `chair.png`, `coffee-machine.png`, `coffee-mug.png`,
`thermos.png`, `watercooler.png`, `floor-tile.png`, `monitor_back.png`, `keyboard_back.png`,
`headset_small.png`, `desk-lamp.png`, `plant.png`, `phone.png`, `stapler.png`,
`pen-holder.png`, `old-printer.png`, `elevator_door.png`, `elevator_frame.png`,
`wall-outlet.png`, `boss-rug.png`, `employee-of-month.png`, `magic-8-ball.png`,
`rubber-duck.png`, `rubiks-cube.png`, `sunglasses.png` + remainder.
Do **not** copy `public/*.svg` (Next.js scaffold).

### 1f. Explicitly NOT copied
```
systems/webSocketController.ts   (139)  <- WebSocket, excluded by rule
systems/typingTracker.ts          (80)  <- Claude typing state
systems/toastFilter.ts            (71)  <- Claude toast pipeline
components/game/AgentStatus.tsx         <- Claude agent/session panel
components/game/EventDetailModal.tsx    <- Claude tool-event inspector
```

---

## 2. Exact files to adapt

| File | Adaptation |
|---|---|
| `game/OfficeGame.tsx` | Drop `useNavigationStore` / `LOBBY_FLOOR_ID` multi-floor branching (single floor). Drop `wireGameRuntime` WebSocket wiring, keep the tick wiring. Replace `useShallow(gameStore)` selector with the Life Office adapter store. Remove `EventDetailModal` / `AgentStatus` mounts. Keep `ZoomControls`, `LoadingScreen`, `OfficeBackground`, `DebugOverlays`. |
| `game/AgentSprite.tsx` | Retype `AgentPhase` from `@/stores/gameStore` to the adapter's phase union. Keep `drawBubble` / `drawArm` / `ICON_MAP` untouched. |
| `game/BossSprite.tsx` | Boss = `manager` employee. Bubble text sourced from `WorkflowState.report` / `approval.action`. |
| `game/Whiteboard.tsx` + `whiteboard/WhiteboardModeRegistry.ts` | Feed `STAGES` / `state.log` / `state.stages` instead of Claude session data. |
| `machines/agentMachineService.ts` | Swap the Claude event feed for `WorkflowEvent`. This is the seam where `STAGE_PHASE_CHANGED` becomes `WALK_TO` / `SIT` / `WORK`. |
| `systems/stateReconciler.ts` | Reconcile against the workflow reducer snapshot instead of the server agent list. |
| `systems/queuePositions.ts` | Retarget desk/coffee/elevator coordinates to the 5 Life Office employees (was N Claude agents). |
| `life-office/useOfficeAnimation.ts` | **Replaced**, not adapted — see §3. Its consumers move to `animationSystem.ts`. |
| `pages/LifeOfficeDemo.tsx` | Swap `<OfficeFloor state sprites/>` for `<OfficeGame/>`. Header, `ApprovalPanel`, `StageList`, `EventLog` stay as-is. |
| `frontend/vite.config.ts`, `tsconfig*.json` | Add `@/*` → `src/*` alias in both. |
| `frontend/package.json` | Add `pixi.js`, `@pixi/react`, `zustand`, `xstate`, `@xstate/react`, `react-zoom-pan-pinch` (pin to the Claude Office versions listed in §0). |

---

## 3. Exact files to delete from current Life Office

Delete (emoji/DOM visual implementation):
```
frontend/src/components/life-office/EmployeeSprite.tsx      (91)
frontend/src/components/life-office/OfficeFloor.tsx        (160)
frontend/src/components/life-office/layout.ts               (46)
frontend/src/components/life-office/useOfficeAnimation.ts  (113)
```
Trim (do not delete — it also styles the surviving panels):
```
frontend/src/components/life-office/life-office.css        (668)
  remove: .lo-floor*, .lo-desk*, .lo-zone*, .lo-sprite*, .lo-path*, .lo-bubble*
  keep:   .lo-root, .lo-header, .lo-grid, .lo-panel, .lo-btn*, .lo-stopped, .lo-note
```

**Keep untouched** (workflow + approval logic — the whole point of the migration):
```
frontend/src/components/life-office/workflow.ts           (433)
frontend/src/components/life-office/types.ts              (115)
frontend/src/components/life-office/useWorkflowEngine.ts   (74)
frontend/src/components/life-office/StageList.tsx          (51)
frontend/src/components/life-office/EventLog.tsx           (22)
frontend/src/components/life-office/ApprovalPanel.tsx      (59)
```

---

## 4. Minimal adapter

One new directory, `frontend/src/components/life-office/adapter/`, is the entire seam. The
visual layer never learns about Life OS; the workflow layer never learns about pixels.

```
adapter/gameStore.ts        zustand store exposing exactly the surface OfficeGame/
                            AgentSprite read from @/stores/gameStore:
                              agents: Record<AgentId, {position, phase, bubble, deskId}>
                              setAgentPosition / setAgentPhase / setBubble
                            Written to only by adapter/bridge.ts.

adapter/bridge.ts           useWorkflowEngine(state) -> gameStore. The mapping:
                              EmployeeActivity  ->  AgentPhase
                                waiting   -> "idle"      (sits at desk, idle anim)
                                walking   -> "walking"   (A* path to zone)
                                working   -> "working"   (typing at desk)
                                reviewing -> "reading"   (bubble + head turn)
                                done      -> "idle"      (returns to desk)
                                stopped   -> "idle"      (bubble = stopReason)
                              StageZone -> destination
                                work   -> WORK_ZONE coords in constants/positions
                                report -> REPORT_ZONE / boss desk
                              approval  -> BubbleContent on the assignee, ! badge
                              coffee: emitted when an employee is "waiting" > N ms,
                                      routes to coffee-machine.png then back to desk
                                      (pure visual idle behaviour, no workflow event)

adapter/types.ts            Position, BubbleContent, AgentId, AgentPhase.
                            Replaces @/types for the copied files.
adapter/constants.ts        Replaces @/constants/positions + @/constants/canvas.
                            5 desks (research/analysis/draft/review/manager) +
                            work zone + report zone + coffee + elevator.
adapter/useOfficeTextures.ts  Pixi Assets.load over /sprites/*.png -> texture map.
adapter/stubs.ts            useTranslation (identity), preferencesStore (defaults),
                            attentionStore (no-op), navigationStore (single floor),
                            useCommandCenterPeers (() => []), event-type-styles,
                            bubbleText.truncateBubbleText, quotes.
```

Direction of dependency stays one-way:
`workflow.ts` → `useWorkflowEngine` → `bridge.ts` → `gameStore` → Pixi components.
No Pixi import ever appears above `bridge.ts`.

---

## 5. Estimated implementation steps

Ordered so the scene is on screen as early as possible (optimising for iteration speed).

1. **Env** — add the 6 deps, add `@/*` alias to `vite.config.ts` + `tsconfig.json`,
   copy `public/sprites/`. Verify `pixi.js` boots under Vite (it is bundler-agnostic;
   `@pixi/react` v8 is the only Next-adjacent risk). ~20 min.
2. **Stubs first** — write `adapter/types.ts`, `constants.ts`, `stubs.ts`,
   `useOfficeTextures.ts`, and a `gameStore.ts` seeded with 5 hard-coded static agents.
   Nothing is wired to the workflow yet. ~45 min.
3. **Copy §1a–§1d verbatim**, fix only import paths. Expect a compile-error sweep;
   resolve each by pointing at the adapter, never by deleting visuals. ~45 min.
4. **First render** — mount `<OfficeGame/>` in `LifeOfficeDemo.tsx` behind the existing
   `.lo-panel`, with the store static. Goal: office map, desks, sprites sitting, whiteboard,
   clock, city window all visible and pixel-identical to Claude Office. **Checkpoint.** ~30 min.
5. **Motion** — wire `animationSystem` + `agentMachineService` to the static store and
   trigger one hard-coded walk. Confirms A*, path smoothing, collision, idle anim.
   **Checkpoint.** ~45 min.
6. **Bridge** — implement `adapter/bridge.ts`, delete the static seed. Workflow now drives
   the office. Verify all 5 stages walk work→report. ~45 min.
7. **Bubbles + approval** — route `approval.action` / `report` / `stopReason` into
   `drawBubble`; confirm `ApprovalPanel` approve/reject still gates the walk. ~30 min.
8. **Coffee + idle** — enable the idle→coffee-machine detour in `bridge.ts`. ~20 min.
9. **Delete §3**, trim the CSS, run `npm run build` + `npm run lint`. ~20 min.

Total ≈ 5 h. Checkpoints at steps 4 and 5 are where a wrong assumption surfaces cheapest.

### Risks
- `@pixi/react` 8.0.5 under Vite instead of Next/Turbopack — untested combination.
- The unverified `@/stores/gameStore` surface is inferred from 15 import sites, not read
  (it is outside the paths I was permitted to read). Step 3 will reveal its real shape and
  may widen `adapter/gameStore.ts`.
- `agentMachineService.ts` (667 lines) assumes an async server event stream; the Life Office
  reducer is synchronous. Step 6 may need a small event-queue shim.
- Life OS `CLAUDE.md` requires a `docs/decisions.md` entry — adding PixiJS + zustand +
  xstate to the frontend is a durable architectural decision and should be recorded there
  before step 1.
