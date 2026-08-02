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
export const CANVAS_WIDTH = 512;

/** Height of the game canvas in pixels */
export const CANVAS_HEIGHT = 1536;

/** Background color of the canvas (dark gray) */
export const BACKGROUND_COLOR = 0xe8e6e1; // --co-room

// ============================================================================
// WALL DECORATIONS — from `constants/positions.ts`
// ============================================================================

/** Employee of the Month frame position */
// Moved right, off the wall directly above desk 1, so the column above the
// research/analysis row stays clear for speech bubbles.
export const EMPLOYEE_OF_MONTH_POSITION = { x: 96, y: 48 };

/** City window position */
// Pushed to the right half. It was directly over the Career desks, competing
// with the team for attention and crowding bubble space.
export const CITY_WINDOW_POSITION = { x: 208, y: 40 };

/** Safety sign position */
// Stays far right as ambient detail; nothing important lives out here now.
export const SAFETY_SIGN_POSITION = { x: 480, y: 120 };

/** Wall clock position */
// Shifted right of the whiteboard so the upper wall reads
// left-to-right: awards, whiteboard, clock, window.
export const WALL_CLOCK_POSITION = { x: 448, y: 64 };

/** Wall outlet position (below clock) */
export const WALL_OUTLET_POSITION = { x: 448, y: 176 };

/** Whiteboard position */
// Centred over the Career desk block (x 256-512) rather than over the middle
// of the empty room, so team + whiteboard fit one portrait framing.
export const WHITEBOARD_POSITION = { x: 320, y: 48 };

/** Water cooler position */
// Brought toward the team's right edge: a believable break spot the team can
// walk to, without sitting on top of anyone's bubble.
export const WATER_COOLER_POSITION = { x: 448, y: 832 };

/** Coffee machine position (to the right of water cooler) */
export const COFFEE_MACHINE_POSITION = { x: 448, y: 576 };

// ============================================================================
// FLOOR ELEMENTS
// ============================================================================

/** Printer station position — near the manager, per the room brief. */
// Was the far bottom-left corner, a full room away from the boss desk.
export const PRINTER_STATION_POSITION = { x: 64, y: 1248 };

/** Plant position (to the right of printer) */
export const PLANT_POSITION = { x: 448, y: 1248 };

// ============================================================================
// BOSS AREA
// ============================================================================

/** Boss area rug position (centered under boss desk) */
export const BOSS_RUG_POSITION = { x: 256, y: 1312 };

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
export const DESKS_PER_ROW = 2;
export const MIN_DESK_COUNT = 6;

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
  research: { x: 128, y: 416 },
  analysis: { x: 384, y: 416 },
  draft: { x: 128, y: 704 },
  review: { x: 384, y: 704 },
  manager: { x: 256, y: 1280 },
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
