/**
 * Adapter constants — replaces `@/constants/positions` and `@/constants/canvas`.
 *
 * Every value below is copied verbatim from the Claude Office source constants.
 * All positions are in pixels relative to the canvas origin (top-left).
 * Do not adjust these to taste — the navigation grid, desk grid and sprite
 * placement are all built against them.
 */

import type { AgentId, Position } from "./types";

// ============================================================================
// CANVAS — from `constants/canvas.ts`
// ============================================================================

/** Width of the game canvas in pixels */
export const CANVAS_WIDTH = 1280;

/** Height of the game canvas in pixels */
export const CANVAS_HEIGHT = 1024;

/** Background color of the canvas (dark gray) */
export const BACKGROUND_COLOR = 0x1a1a1a;

// ============================================================================
// WALL DECORATIONS — from `constants/positions.ts`
// ============================================================================

/** Employee of the Month frame position */
export const EMPLOYEE_OF_MONTH_POSITION = { x: 184, y: 50 };

/** City window position */
export const CITY_WINDOW_POSITION = { x: 319, y: 30 };

/** Safety sign position */
export const SAFETY_SIGN_POSITION = { x: 1120, y: 40 };

/** Wall clock position */
export const WALL_CLOCK_POSITION = { x: 581, y: 80 };

/** Wall outlet position (below clock) */
export const WALL_OUTLET_POSITION = { x: 581, y: 209 };

/** Whiteboard position */
export const WHITEBOARD_POSITION = { x: 641, y: 11 };

/** Water cooler position */
export const WATER_COOLER_POSITION = { x: 1010, y: 200 };

/** Coffee machine position (to the right of water cooler) */
export const COFFEE_MACHINE_POSITION = { x: 1081, y: 191 };

// ============================================================================
// FLOOR ELEMENTS
// ============================================================================

/** Printer station position (bottom left corner) */
export const PRINTER_STATION_POSITION = { x: 50, y: 945 };

/** Plant position (to the right of printer) */
export const PLANT_POSITION = { x: 118, y: 970 };

// ============================================================================
// BOSS AREA
// ============================================================================

/** Boss area rug position (centered under boss desk) */
export const BOSS_RUG_POSITION = { x: 640, y: 940 };

/** Trash can offset from boss desk position */
export const TRASH_CAN_OFFSET = { x: 110, y: 65 };

// ============================================================================
// DESK GRID
// ============================================================================

/**
 * Desk grid shape — keep in sync with backend `state_machine.py`
 * `StateMachine.DESKS_PER_ROW` / `StateMachine.MIN_DESK_COUNT`.
 * A shared cross-component source is intentionally out of scope; update both
 * sides together when changing the desk grid.
 */
export const DESKS_PER_ROW = 4;
export const MIN_DESK_COUNT = 8;

// ============================================================================
// LIFE OFFICE — NOT FROM SOURCE
// ============================================================================

/**
 * Seed positions for the five hard-coded employees in `gameStore.ts`.
 *
 * These are still invented. The source has no per-employee desk map — it
 * derives desks from `getDeskPosition(deskNum)` in `systems/queuePositions.ts`.
 * Replacing this with that function is the correct fix, but it touches
 * `gameStore.ts`, which was out of scope for the coordinate recovery.
 */
export const DESK_POSITIONS: Record<AgentId, Position> = {
  research: { x: 220, y: 200 },
  analysis: { x: 220, y: 340 },
  draft: { x: 220, y: 480 },
  review: { x: 460, y: 200 },
  manager: { x: 460, y: 480 },
};

/**
 * Where each employee stands while working on an active stage.
 * Offset to the right of their desk so the walk is visible.
 */
export const WORK_POSITIONS: Record<AgentId, Position> = {
  research: { x: 640, y: 400 },
  analysis: { x: 700, y: 460 },
  draft: { x: 760, y: 400 },
  review: { x: 700, y: 340 },
  manager: { x: 640, y: 900 },
};
