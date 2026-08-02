# Visual Migration — Step 2 (adapter stubs)

Step 2 of the plan only: the adapter seam. No game components copied, no workflow/reducer
connection, no bridge, no UI change. Nothing was run to verify (tests/lint/typecheck/browser
excluded by the task).

## Created

`frontend/src/components/life-office/adapter/`

| File | Replaces | Contents |
|---|---|---|
| `types.ts` | `@/types` | `Position`, `AgentId` (5 hard-coded ids), `AGENT_IDS`, `AgentPhase` (`idle`/`walking`/`working`/`reading`/`coffee`), `BubbleContent`, `AgentVisualState`. |
| `constants.ts` | `@/constants/positions`, `@/constants/canvas` | `CANVAS` (1280×720, 32px tile), `DESK_POSITIONS` for all 5, `WORK_ZONE`, `REPORT_ZONE`, `COFFEE_ZONE`, `ELEVATOR_POSITION`, printer/whiteboard/trash anchors. |
| `gameStore.ts` | `@/stores/gameStore` | zustand store seeded with the 5 employees sitting at their desks, `phase: "idle"`. Setters for position/target/phase/bubble, plus `ready` and `reset`. |
| `useOfficeTextures.ts` | `@/hooks/useOfficeTextures` | Rewritten (not copied). `Assets.load` over the **25** sprite names from Step 1, keyed by basename. Returns `{ textures, loaded }`. |
| `stubs.ts` | 8 misc modules | `useTranslation` (identity), `usePreferencesStore`, `useAttentionStore`, `useNavigationStore` + `LOBBY_FLOOR_ID` (single floor), `useCommandCenterPeers` (`[]`), `truncateBubbleText`, `eventTypeStyle`, `QUOTES`. |

Five hard-coded employees, matching the existing Life Office ids and names but **imported from
nowhere** — `workflow.ts` is not referenced, per "no workflow connection":

```
research 김리서치 · analysis 박분석 · draft 이작성 · review 최검수 · manager 한매니저
```

## Design note

`gameStore.ts` currently has no writer. That is intentional: the plan puts `bridge.ts` at
Step 6 as the single writer, so until then the scene is static by construction and any
movement seen on screen would be a bug in the copied systems, not the workflow.

## Unverified — read before Step 3

The adapter's shape is **inferred, not observed**. `@/stores/gameStore`, `@/types`,
`@/constants/*` live outside the paths I have been allowed to read; the surfaces above were
reconstructed from 15 `@/stores/gameStore` and 31 `@/types` import *sites*, not from the
modules themselves.

Concretely, expect Step 3 to force changes here when the copied files are compiled against it:

- `AgentPhase` member names are a guess. `AgentSprite.tsx` switches on them; wrong names
  produce a sprite stuck in a default pose rather than a compile error in every case.
- `BubbleContent` field names (`text`/`icon`/`urgent`) are a guess — `drawBubble.ts` is the
  authority.
- `CANVAS` dimensions and every coordinate in `constants.ts` are invented. They are internally
  consistent but will not match the original office layout; desks may not line up with
  `desk.png` placement until reconciled against `OfficeBackground.tsx` and `DeskGrid.tsx`.
- `gameStore` is keyed by a 5-member `AgentId` union. The source keyed agents by dynamic
  string id (N Claude agents), so `queuePositions.ts` and `agentCollision.ts` may expect
  `Record<string, …>` and require widening.

None of this blocks Step 3 — the plan already budgets an "error sweep" there, and each error
resolves by pointing at the adapter.

## Next

Step 3: copy §1a–§1d verbatim, fix import paths only, resolve errors against the adapter
rather than by deleting visuals.
