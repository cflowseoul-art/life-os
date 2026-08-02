# Vertical Office Layout — Plan

One map, portrait, used on every device. Plan only; no code modified.

## Canvas

**512 × 1536**, tile 32 px → grid **16 × 48**. Background `0x1a1a1a` unchanged.

Why 512: at the 390 px target viewport the scale is `390/512 = 0.762`. A 28 px agent radius
renders at ~21 px and a 200 px bubble at ~152 px — both readable without re-authoring sprites.
640 wide would drop to 0.61 and shrink text below comfort; 384 would fit 1:1 but leaves no room
for two desk columns plus a corridor. Aspect 1:3 fits a portrait scroll and keeps desktop as
the same map, centred, with letterbox margins.

Everything below is a multiple of 32 unless noted, so `markRectangle` lands on whole tiles.

## Coordinates

All values are **agent body centre** for seats, sprite anchor otherwise, matching the current
convention in `getDeskPosition`.

### Zones, top to bottom

| y range | Contents |
|---|---|
| 0-160 | Wall band (decorations only, impassable) |
| 160-288 | Entrance / elevator apron |
| 288-1088 | Desk field, 3 rows |
| 1088-1216 | Open floor / approach |
| 1216-1408 | Manager area + printer |
| 1408-1536 | Bottom wall margin |

### Employee desks — 2 columns, 3 rows

Columns at **x = 128** (left) and **x = 384** (right). Desk half-width stays 70, so surfaces
occupy 58-198 and 314-454, leaving a **116 px central corridor (x 198-314)**.

| Desk # | Occupant | Position |
|---|---|---|
| 1 | research 김리서치 | **{ x: 128, y: 416 }** |
| 2 | analysis 박분석 | **{ x: 384, y: 416 }** |
| 3 | draft 이작성 | **{ x: 128, y: 704 }** |
| 4 | review 최검수 | **{ x: 384, y: 704 }** |
| 5 | *(empty, reserved)* | **{ x: 128, y: 992 }** |
| 6 | representative / report desk *(empty)* | **{ x: 384, y: 992 }** |

Row pitch 288 px (was 192) — the extra 96 px is what keeps a bubble from one row off the
sprite above it.

### Fixed points

| Element | Position |
|---|---|
| Manager desk (boss render) | **{ x: 256, y: 1280 }** |
| Boss slot left (arrivals) | **{ x: 176, y: 1248 }** |
| Boss slot right (departures) | **{ x: 336, y: 1248 }** |
| Report point (representative) | **{ x: 384, y: 992 }** — the reserved desk above |
| Coffee machine | **{ x: 448, y: 576 }** (right wall, between rows 1-2) |
| Water cooler | **{ x: 448, y: 832 }** (right wall, between rows 2-3) |
| Elevator / entrance | **{ x: 96, y: 176 }** |
| Elevator pathfinding target | **{ x: 96, y: 256 }** |
| Printer station | **{ x: 64, y: 1248 }** |
| Plant | **{ x: 448, y: 1248 }** |
| Boss rug | **{ x: 256, y: 1312 }** |
| Whiteboard | **{ x: 320, y: 48 }** |
| Wall clock | **{ x: 448, y: 64 }** |
| Wall outlet | **{ x: 448, y: 176 }** |
| Employee of the Month | **{ x: 96, y: 48 }** |
| City window | **{ x: 208, y: 40 }** |
| Safety sign | **{ x: 480, y: 120 }** |

Trash can keeps its offset form relative to the boss desk; with `TRASH_CAN_OFFSET` unchanged
`{ x: 110, y: 65 }` it lands at { 366, 1345 } — inside the canvas, no change needed.

### Walking lanes

- **Spine**: vertical lane centred **x = 256**, width 116 px (x 198-314), running **y 176 →
  1248**. Continuous: no desk, printer, or prop intrudes.
- **Desk spurs**: horizontal, at **y = 416, 704, 992**, from the spine edge to the seat —
  x 198→128 (left) and x 314→384 (right). Each is one desk-row tall and free of obstacles
  because the desk *surface* obstacle sits below the seat, as it does today.
- **Coffee spur**: y = 576, x 314 → 448. **Cooler spur**: y = 832, x 314 → 448.
- **Manager apron**: the spine widens to the full 512 below y = 1216 so both boss slots are
  reachable from either side.

Every destination in this plan is on the spine or one spur off it, so A* always has a path.

### Bubble containment

`drawBubble` is drawn centred on the agent at `yOffset ≈ -80`, worst case ~200 px wide.

- Left column x = 128 → bubble spans **28…228**. Fits.
- Right column x = 384 → spans **284…484**. Fits.
- Boss x = 256 → spans **156…356**. Fits.
- Topmost seat y = 416, bubble top ≈ 296 — clear of the 160 px wall band, so no bubble is
  drawn into the wall.

The 116 px corridor is what buys this: columns cannot sit closer to the edges than 128/384
without pushing a 200 px bubble off-canvas. **This is the constraint that fixes the column
positions** — not aesthetics.

## Constants and grid assumptions that must change

`adapter/constants.ts`
- `CANVAS_WIDTH` 1280 → **512**; `CANVAS_HEIGHT` 1024 → **1536**
- `DESKS_PER_ROW` 4 → **2**; `MIN_DESK_COUNT` 8 → **6** (comment says keep in sync with backend
  `state_machine.py` — that file is out of scope here and must be updated with it)
- Every wall/floor prop constant listed in the table above
- `DESK_POSITIONS` — replace with the six seats above, or better, delete it and derive from
  `getDeskPosition` (its own comment already calls this the correct fix)
- `WORK_POSITIONS` — already dead after the desk-routing fix; delete rather than re-map

`systems/queuePositions.ts`
- `getDeskPosition`: `xStart` 256 → **128**, column pitch 256 → **256** (unchanged), row pitch
  192 → **288**, base y 432 → **416**
- `BOSS_POSITION`, `BOSS_SLOT_LEFT`, `BOSS_SLOT_RIGHT`
- `ELEVATOR_POSITION`, `ELEVATOR_PATHFINDING_TARGET`, `ELEVATOR_DEPARTURE_POSITION`,
  `ELEVATOR_SPAWN_POSITIONS` (6 slots, re-centre on x = 96)
- `ELEVATOR_ZONE` — drives `isInElevatorZone`, which suppresses bubbles; new box
  **{ minX: 40, maxX: 152, minY: 96, maxY: 320 }**

`systems/navigationGrid.ts`
- `GRID_WIDTH` 40 → **16**; `GRID_HEIGHT` 32 → **48**
- `DESK_X_POSITIONS` `[256,512,768,1024]` → **[128, 384]**
- Desk row bands: the two `DESK_ROW_*` pairs become **three** rows at the new pitch — row
  surfaces at y ≈ 472-520, 760-808, 1048-1096, each ±`OBSTACLE_PADDING`
- `WALL_Y_END` 232 → **160** (+padding)
- Boss desk, printer, and trash rectangles follow their new anchors

`game/OfficeBackground.tsx`
- `WALL_HEIGHT` 250 → **160** to match `WALL_Y_END`. Everything else there is already
  expressed in terms of `CANVAS_WIDTH`/`CANVAS_HEIGHT` (walls at lines 55-64, tile loop at
  79-82), so it reflows to portrait with no other edit.

Camera: `adapter/camera-presets.ts` clamps against canvas size and was not in the read list —
its bounds and the default mobile preset will need re-deriving. Flagging, not specifying.

## Preserved verbatim

No change to any of these:

- `shared/drawBubble.ts`, `shared/drawArm.ts`, `shared/iconMap.ts`
- `AgentSprite.tsx`, `BossSprite.tsx` — sprite geometry, arms, capsule, headset, labels
- All 25 sprite PNGs and their draw scales
- `Whiteboard.tsx` and all whiteboard modes, `CityWindow.tsx` + `city/*`, `WallClock.tsx`,
  `DigitalClock.tsx`, `SafetySign.tsx`, `EmployeeOfTheMonth.tsx`, `PrinterStation.tsx`,
  `TrashCanSprite.tsx`, `Elevator.tsx`, `MarqueeText.tsx`
- Walking: `astar.ts`, `pathfinding.ts`, `pathSmoothing.ts`, `agentCollision.ts`,
  `animationSystem.ts` — all read the grid, none hardcode its size
- `adapter/coffeeIdle.ts` — reads `COFFEE_MACHINE_POSITION` and `getDeskPosition`, so it
  follows the new map with no edit
- Bubble expiry, `workflowBridge.ts` message table, approval and report logic

The props move; nothing about how they are drawn changes.

## Risks

Two, both unverified because implementation is out of scope:

1. **Tile-count assumptions elsewhere.** `GRID_WIDTH`/`GRID_HEIGHT` are exported and may be
   imported by files outside the five I read (`queuePositions`, `commandCenterGrid`, debug
   overlays). A stale 40×32 assumption anywhere produces silent out-of-bounds indexing, not a
   crash.
2. **Three desk rows vs. a two-row grid builder.** `initializeStaticGrid` hardcodes
   `for (let row = 0; row < 2; row++)`. Adding the third row is a real code change, not a
   constant swap — it is the one place this plan cannot be delivered by re-numbering alone.
