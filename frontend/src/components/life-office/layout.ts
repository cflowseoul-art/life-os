/**
 * Life Office — VISUAL layer constants.
 *
 * Coordinates are percentages of the office floor box, so the scene scales with
 * the container. Nothing here affects workflow meaning; deleting a desk position
 * would only move a sprite, never change a stage outcome.
 */

import type { EmployeeId } from "./types";

export type Point = { x: number; y: number };

/** Home desk for each employee — where they sit while waiting. */
export const DESKS: Record<EmployeeId, Point> = {
  research: { x: 14, y: 32 },
  analysis: { x: 14, y: 56 },
  draft: { x: 14, y: 80 },
  review: { x: 33, y: 32 },
  manager: { x: 33, y: 80 },
};

/** Meeting table in the middle of the floor — where active work happens. */
export const WORK_ZONE: Point = { x: 60, y: 40 };

/** Report area on the right — the manager's final destination. */
export const REPORT_ZONE: Point = { x: 82, y: 66 };

/** Decorative anchors — nobody walks here yet. */
export const ENTRANCE: Point = { x: 6, y: 88 };
export const COFFEE_ZONE: Point = { x: 84, y: 26 };

/** Corridor centre lines (percent), drawn as walking paths. */
export const PATH_H_Y = 66;
export const PATH_V_X = 47;

/** Milliseconds a walk transition takes; matches TIMING.walking. */
export const WALK_DURATION_MS = 1600;

/** Sprite card size in px — zone/desk spacing is derived from it. */
export const SPRITE_CARD = { width: 104, height: 104 } as const;

/** Vertical gap (px) between a zone anchor point and its label card. */
export const ZONE_LABEL_OFFSET_PX = 120;

/** Vertical gap (px) between the report anchor and the speech bubble. */
export const BUBBLE_OFFSET_PX = 84;
