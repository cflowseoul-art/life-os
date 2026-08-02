# Vertical Office — Step 1 (static coordinates)

Two files changed: `adapter/constants.ts` and `game/OfficeBackground.tsx`. Constants only —
no navigationGrid, pathfinding, animation, workflow, bubble, coffee, approval, or camera edit.

## Applied

`adapter/constants.ts` — every value taken verbatim from the plan:

| Constant | Was | Now |
|---|---|---|
| `CANVAS_WIDTH` | 1280 | **512** |
| `CANVAS_HEIGHT` | 1024 | **1536** |
| `DESKS_PER_ROW` | 4 | **2** |
| `MIN_DESK_COUNT` | 8 | **6** |
| `EMPLOYEE_OF_MONTH_POSITION` | 120, 50 | **96, 48** |
| `CITY_WINDOW_POSITION` | 880, 30 | **208, 40** |
| `SAFETY_SIGN_POSITION` | 1160, 40 | **480, 120** |
| `WALL_CLOCK_POSITION` | 700, 80 | **448, 64** |
| `WALL_OUTLET_POSITION` | 700, 209 | **448, 176** |
| `WHITEBOARD_POSITION` | 400, 11 | **320, 48** |
| `WATER_COOLER_POSITION` | 800, 300 | **448, 832** |
| `COFFEE_MACHINE_POSITION` | 880, 300 | **448, 576** |
| `PRINTER_STATION_POSITION` | 880, 940 | **64, 1248** |
| `PLANT_POSITION` | 960, 965 | **448, 1248** |
| `BOSS_RUG_POSITION` | 640, 940 | **256, 1312** |

`DESK_POSITIONS` → research { 128, 416 }, analysis { 384, 416 }, draft { 128, 704 },
review { 384, 704 }, manager { 256, 1280 }.

`TRASH_CAN_OFFSET` left at { 110, 65 } as the plan specified — relative to the boss desk, it
lands in-canvas.

`game/OfficeBackground.tsx` — `WALL_HEIGHT` 250 → **160**. Nothing else there needed touching:
the wall rects (lines 55-64) and the floor-tile loop (79-82) are already written against
`CANVAS_WIDTH`/`CANVAS_HEIGHT`, so they reflow to portrait on their own. No sprite or draw call
changed.

`OfficeGame.tsx` was read and **not modified** — it consumes all of the above through imports,
so it picked up the new map with no edit.

## Not applied — outside the readable files

The task lists "manager area", "representative/report point", and "elevator" as things to
change, but those constants live in `systems/queuePositions.ts`, which is not in this step's
read list. **They are still on the old horizontal map:**

| Constant | Still | Plan wants |
|---|---|---|
| `BOSS_POSITION` | 640, 900 | 256, 1280 |
| `BOSS_SLOT_LEFT` | 520, 868 | 176, 1248 |
| `BOSS_SLOT_RIGHT` | 760, 868 | 336, 1248 |
| `ELEVATOR_POSITION` | 86, 178 | 96, 176 |
| `ELEVATOR_PATHFINDING_TARGET` | 86, 192 | 96, 256 |
| `ELEVATOR_DEPARTURE_POSITION` | 86, 200 | 96, ~272 |
| `ELEVATOR_SPAWN_POSITIONS` | 6 slots near x 56/116 | re-centre on x 96 |
| `ELEVATOR_ZONE` | 30-142, 90-300 | 40-152, 96-320 |
| `getDeskPosition` | xStart 256, pitch 256/192, base y 432 | xStart 128, row pitch 288, base y 416 |

This matters more than it looks: `gameStore.ts` seeds employee positions from
`getDeskPosition`, **not** from `DESK_POSITIONS`. So the seats I just rewrote in
`DESK_POSITIONS` are not what the sprites actually use — the four employees will still be
placed on the old 1280-wide grid (x 256-1024), now well outside a 512-wide canvas. The
representative/report point at { 384, 992 } exists only as a plan entry; nothing references it
yet.

Net: props, walls, and canvas are portrait; **employees and boss are not.** The scene will look
broken until `queuePositions.ts` is done. That is the correct next step, not a defect in this
one — it was excluded by the read list.

## Not verified

Only that all three modules still transform under Vite (HTTP 200). Tests, lint, build, and
browser were excluded, and the plan's own risk list (navgrid still 40×32, two-row loop) is
untouched by design.

## Future Improvements

1. **`DESK_POSITIONS` is dead weight.** Its own comment says so, and `gameStore` uses
   `getDeskPosition` instead. I updated it to stay consistent with the plan, but the honest fix
   is deletion — two sources for one fact is exactly what made this step half-effective.
2. **`WORK_POSITIONS` is still on the old map** (x 640-760, y 340-900) and still dead after the
   desk-routing fix. Left untouched; it should be deleted rather than re-mapped.
3. **`GRID_WIDTH`/`GRID_HEIGHT` are now inconsistent with the canvas** — 40×32 tiles describing
   a 512×1536 room. Pathfinding will index outside the visible floor until Step 2.
