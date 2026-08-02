/**
 * Camera presets and bounds for the Office view.
 *
 * Presets are data. Adding a team later means adding an entry here — the
 * navigator renders whatever this array contains and needs no new JSX.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";

export type CameraPreset = {
  id: string;
  label: string;
  /** Point in Office coordinates to centre on. */
  center: { x: number; y: number };
  /** Target scale, clamped to the wrapper's min/max. */
  scale: number;
  /** Rendered but not yet wired (e.g. the future minimap). */
  disabled?: boolean;
};

/**
 * Career team occupies desks 1, 2, 5, 6 — world coordinates (256,432),
 * (512,432), (256,624), (512,624) — plus the manager at the boss desk
 * (640,900). The preset centres that bounding box and picks a scale that fits
 * its ~500x570 extent on a portrait phone. Desks are never moved to suit the
 * camera; only centre and scale are tuned.
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "all",
    label: "전체",
    center: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    scale: 0.6,
  },
  {
    id: "career",
    label: "커리어팀",
    center: { x: 448, y: 666 },
    scale: 0.8,
  },
  {
    id: "map",
    label: "지도",
    center: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
    scale: 1,
    disabled: true,
  },
];

export const DEFAULT_MOBILE_PRESET = "career";

/** Maximum visible margin outside the Office, in screen pixels. */
const MAX_MARGIN = 16;

/*
 * positionX convention (react-zoom-pan-pinch): the transform is
 * `translate(positionX, positionY) scale(scale)` applied to the content box.
 *
 *   positionX =  0                        -> content left edge at viewport
 *                                            left  => FAR-LEFT office edge
 *   positionX =  viewport - scaledWidth   -> content right edge at viewport
 *                                            right => FAR-RIGHT office edge
 *
 * So the travel range is [viewport - scaledWidth, 0], widened by the margin
 * on both sides. Same convention on Y. This only holds when the content box
 * is the office itself (1280x1024) — see OfficeGame's contentStyle.
 *
 * Sanity check, mobile portrait 390px @ scale 0.8 (scaledWidth 1024):
 *   min = 390 - 1024 - 16 = -650   (far-right edge reachable)
 *   max = 16                       (far-left edge reachable)
 *   travel = 666px  >=  1024 - 390 = 634px of hidden office  ✔
 */
if (import.meta.env.DEV) {
  const probe = clampTransform(-5000, 0, 0.8, 390, 844);
  const rightEdge = 390 - 1280 * 0.8 - MAX_MARGIN;

  if (Math.abs(probe.positionX - rightEdge) > 0.5) {
    console.warn(
      "[camera] far-right edge unreachable:",
      probe.positionX,
      "expected",
      rightEdge,
    );
  }
}

/**
 * Clamp a transform so the Office never reveals empty space beyond a small
 * margin. When the scaled Office is smaller than the viewport on an axis it is
 * centred on that axis instead of clamped.
 */
export function clampTransform(
  positionX: number,
  positionY: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
): { positionX: number; positionY: number } {
  const scaledWidth = CANVAS_WIDTH * scale;
  const scaledHeight = CANVAS_HEIGHT * scale;

  const axis = (
    position: number,
    scaledSize: number,
    viewportSize: number,
  ): number => {
    if (scaledSize <= viewportSize) {
      // Smaller than the viewport: centre, do not allow free drift.
      return (viewportSize - scaledSize) / 2;
    }

    const min = viewportSize - scaledSize - MAX_MARGIN;
    const max = MAX_MARGIN;

    return Math.min(max, Math.max(min, position));
  };

  return {
    positionX: axis(positionX, scaledWidth, viewportWidth),
    positionY: axis(positionY, scaledHeight, viewportHeight),
  };
}

/** Transform that puts `center` in the middle of the viewport, then clamps. */
export function transformForPreset(
  preset: CameraPreset,
  viewportWidth: number,
  viewportHeight: number,
): { positionX: number; positionY: number; scale: number } {
  const { scale } = preset;

  const raw = {
    positionX: viewportWidth / 2 - preset.center.x * scale,
    positionY: viewportHeight / 2 - preset.center.y * scale,
  };

  return {
    ...clampTransform(
      raw.positionX,
      raw.positionY,
      scale,
      viewportWidth,
      viewportHeight,
    ),
    scale,
  };
}

// --- controller ------------------------------------------------------------
// OfficeGame owns the TransformWrapper ref; the navigator lives in the page.
// This tiny registry connects them without either importing the other.

type ApplyFn = (
  positionX: number,
  positionY: number,
  scale: number,
) => void;

let apply: ApplyFn | null = null;

/**
 * Actual wrapper viewport, supplied by OfficeGame. `window.innerWidth/Height`
 * is not the same box — the stage sits under a top bar and inside a shell —
 * and using it was one half of the asymmetry.
 */
let viewport: (() => { width: number; height: number }) | null = null;

export function registerViewport(
  fn: (() => { width: number; height: number }) | null,
): void {
  viewport = fn;
}

function readViewport(): { width: number; height: number } {
  return (
    viewport?.() ?? {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  );
}

/**
 * The single source of truth for camera bounds. Used for preset destinations
 * and for re-clamping after a manual gesture, so both obey identical limits.
 */
export function clampCurrent(
  positionX: number,
  positionY: number,
  scale: number,
): { positionX: number; positionY: number } {
  const { width, height } = readViewport();

  return clampTransform(positionX, positionY, scale, width, height);
}

/** Notified when the user moves the camera themselves. */
let onManualMove: (() => void) | null = null;

export function registerCamera(fn: ApplyFn | null): void {
  apply = fn;
}

export function onCameraMovedByUser(fn: (() => void) | null): void {
  onManualMove = fn;
}

/**
 * Called by the view after a user-driven pan/pinch so the navigator can drop
 * its active highlight. Preset-driven moves suppress this.
 */
export function notifyManualMove(): void {
  onManualMove?.();
}

/** Set while a preset animation runs, so it is not mistaken for a manual pan. */
let applyingUntil = 0;

export function isApplyingPreset(): boolean {
  return Date.now() < applyingUntil;
}

export function applyPreset(preset: CameraPreset): void {
  if (!apply || preset.disabled) {
    return;
  }

  applyingUntil = Date.now() + 600;

  const { width, height } = readViewport();
  const transform = transformForPreset(preset, width, height);

  apply(transform.positionX, transform.positionY, transform.scale);
}
