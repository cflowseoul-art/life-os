# Vertical Office — Step 2 (grid + positions)

Three files changed: `systems/queuePositions.ts`, `systems/navigationGrid.ts`, and one line in
`adapter/gameStore.ts` (see "Scope deviation"). No visual component, workflow, bubble, coffee,
approval, or camera edit. `backend/state_machine.py` untouched.

## `systems/queuePositions.ts`

| Constant | Was | Now |
|---|---|---|
| `getDeskPosition` | `xStart 256`, `y = 432 + row*192` | **`xStart 128`, `y = 416 + row*288`** |
| `BOSS_POSITION` | 640, 900 | **256, 1280** |
| `BOSS_SLOT_LEFT` | 520, 868 | **176, 1248** |
| `BOSS_SLOT_RIGHT` | 760, 868 | **336, 1248** |
| `ELEVATOR_POSITION` | 86, 178 | **96, 176** |
| `ELEVATOR_PATHFINDING_TARGET` | 86, 192 | **96, 256** |
| `ELEVATOR_DEPARTURE_POSITION` | 86, 200 | **96, 272** |
| `ELEVATOR_SPAWN_POSITIONS` | x 56/116, y 190-290 | **x 66/126, y 200/250/300** |
| `ELEVATOR_ZONE` | 30-142, 90-300 | **40-152, 96-320** |

Column pitch stays 256, so `getDeskPosition` yields exactly the plan's six seats:

```
desk 1 {128, 416}   desk 2 {384, 416}
desk 3 {128, 704}   desk 4 {384, 704}
desk 5 {128, 992}   desk 6 {384, 992}
```

**`REPORT_POSITION` added** — `{ x: 384, y: 992 }`, desk 6, with a comment marking it reserved.
It is exported but has no consumer yet; wiring it is Step 3's business.

**Queue positions re-derived.** Both queues were entirely outside a 512-wide canvas (arrival
ran to x 480, departure to x 1210). They now hug the manager apron and run up the side walls:
arrival `{176,1216} → {96,1216} → x 64` climbing to y 832; departure
`{336,1216} → {416,1216} → x 448` climbing to y 864. These are **derived, not from the plan** —
the plan specifies lanes and fixed points but not queue slots.

## `systems/navigationGrid.ts`

- `GRID_WIDTH` 40 → **16**, `GRID_HEIGHT` 32 → **48**
- `WALL_Y_END` 232 → **160** (+padding), matching Step 1's `WALL_HEIGHT`
- `DESK_X_POSITIONS` `[256,512,768,1024]` → **`[128, 384]`**
- `BOSS_DESK_X/Y` 640/960 → **256/1344** (boss y + 60, grid-aligned 42×32)
- `PRINTER_X/Y` 50/993 → **64/1248**; trash can anchors follow the boss to **366/1365**

**The hardcoded two-row loop is gone.** `DESK_ROW_0_Y` / `DESK_ROW_1_Y` were replaced by a
`DESK_ROW_BANDS` array of three bands — 472-520, 760-808, 1048-1096 (±`OBSTACLE_PADDING`) —
and `for (let row = 0; row < 2; row++)` became `for (const band of DESK_ROW_BANDS)`. The bands
keep the original seat→surface offset (seat+56 … seat+104), so chairs remain walkable
destinations exactly as before.

## Scope deviation — one line in `gameStore.ts`

`DESK_ASSIGNMENTS` had `draft: 5, review: 6`. With `DESKS_PER_ROW = 2` those resolve to desks 5
and 6, which the task requires to stay **empty**, and desk 6 is the reserved report point. The
requirement could not be met without this, so `draft` → **3** and `review` → **4**, seating them
at {128, 704} and {384, 704}.

`gameStore.ts` was not in this step's read or change list. Flagging rather than deciding
silently; revert the line if you would rather move the reservation to different desk numbers.

## Result

All five now land inside the 512 × 1536 canvas: research {128,416}, analysis {384,416},
draft {128,704}, review {384,704}, 한매니저 {256,1280}. Desks 5 {128,992} and 6 {384,992} are
unoccupied.

## Not verified

Only that both systems modules still transform under Vite (HTTP 200). Tests, lint, build, and
browser were excluded. Specifically unobserved: whether the three desk bands leave the spine
walkable in practice, and whether the re-derived queue slots sit on walkable tiles — the
markRectangle calls that would collide with them are in the same file but were not simulated.

## Future Improvements

1. **Queue positions are invented.** Eight arrival + eight departure slots were placed by hand
   to fit the portrait canvas. They are plausible, not designed, and nothing currently walks
   them (no arrival/departure flow is wired), so errors there are latent.
2. **`DESK_POSITIONS` in `constants.ts` is now redundant and disagrees in intent** — Step 1
   updated it to five employee seats while `getDeskPosition` is the real source. Deleting it
   remains the right fix.
3. **`MIN_DESK_COUNT = 6` vs. backend `state_machine.py`** — `constants.ts` says keep them in
   sync; the backend is explicitly out of scope, so they are now out of sync.
