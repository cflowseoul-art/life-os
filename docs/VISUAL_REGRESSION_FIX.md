# Visual Regression — Fix Applied

Both fixes from `VISUAL_REGRESSION_CAUSE.md` are applied. Two files touched, no CSS, no
refactor, no dead-code cleanup. **Neither fix was visually verified** — see below.

## 1. `game/OfficeGame.tsx` — right-pan restored to `221ecb1`

Reverted the pan surface to the exact `221ecb1` implementation, in two hunks.

**TransformWrapper props** — restored `minScale={1}` (was `0.6`), `wheel={{ step: 0.1 }}`
(was `{ disabled: true }`), and removed the three settle handlers `222ae95` added
(`onPanningStop`, `onPinchStop`, `onZoomStop`). Everything else on the element is byte-identical
to `221ecb1`, including `limitToBounds={false}`, which that commit also had.

**TransformComponent content box** — restored `contentClass="w-full h-full"` and
`<div className="pixi-canvas-container w-full h-full">`, replacing the fixed-pixel
`contentStyle` / inline `style` that sized the box to `CANVAS_WIDTH × CANVAS_HEIGHT`.

Untouched, per "do not touch other camera logic": `registerCamera` / `registerViewport`
(lines 334-345), `clampCurrent` and the other `camera-presets` imports (98-102), and the
`settleWithinBounds` callback itself (198) — now uncalled, left in place deliberately.

### Correction to the cause document

`VISUAL_REGRESSION_CAUSE.md` offered "set line 360 `limitToBounds={false}` → `true`" as the
one-attribute fix. That is wrong and was not done: `221ecb1` had `limitToBounds={false}` too,
so flipping it would not restore the prior behaviour — it would be a third variant. The real
delta from `221ecb1` is the settle handlers plus the two scale/wheel props, which is what was
reverted.

### Risk taken, worth knowing

The removed `contentStyle` block carried a comment claiming the fixed-pixel content box was
itself required for the right edge to be reachable: a viewport-sized box means the library
"translates a box narrower than 1280 and the right edge is unreachable no matter what the
clamp allows." That comment postdates `221ecb1` and contradicts the premise that `221ecb1`
panned correctly. The instruction was to use the exact prior implementation, so the fixed-pixel
box was reverted along with the rest. If rightward pan is still short of the right edge after
this change, that comment was right and this hunk is the one to reinstate — the props hunk is
independent and can stay.

## 2. `pages/LifeOfficeDemo.tsx` — chip row removed

Deleted only the `<nav className="lo-navigator">` block (formerly lines 346-362) that mapped
`CAMERA_PRESETS` to `.lo-nav-chip` buttons. Nothing else in the page changed.

Left in place as instructed: the topbar at line 305 (`🏢 Life Office — 커리어팀`) is header UI,
not the chip row, so the word 커리어팀 still appears in the title. The now-unused `applyPreset`
import, `activePreset` state (128-130), and the two preset effects remain — dead-code cleanup
deferred.

## Verification

| Check | Result |
|---|---|
| Both modules transform under Vite | ✅ `LifeOfficeDemo.tsx` 200, `OfficeGame.tsx` 200 |
| Rightward pan works | ❌ **not verified** |
| 커리어팀 / 전체 row gone | ❌ **not verified** |

The Chrome extension is still not connected (same failure as Step 5: "Browser extension is not
connected"). One attempt, then stopped. Both of the required visual checks are therefore
outstanding.

HTTP 200 from Vite's transform pipeline means the edits parse and imports resolve — nothing
more. It says nothing about whether the canvas pans or the chips are gone.

**To close this out:** the dev server is running on `http://localhost:5173/`. Drag the office
leftward to pan right, and confirm no chip row sits above the tab bar. Both checks are seconds
of looking.

## Unused-symbol note

`settleWithinBounds` (OfficeGame.tsx:198) and `applyPreset` / `activePreset`
(LifeOfficeDemo.tsx:31, 128) are now unreferenced. Vite dev does not care. If
`tsc -b` runs with `noUnusedLocals`, the build will flag them — that is the point at which the
deferred cleanup becomes required rather than optional. `npm run build` was not run.
