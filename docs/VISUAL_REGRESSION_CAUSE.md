# Visual Regression — Cause

Scope: three files only (`LifeOfficeDemo.tsx`, `game/OfficeGame.tsx`, `life-office.css`).
No code modified. Two regressions, two different commits — they are unrelated.

## Commit timeline for these three files

```
3ac9b9a  fix: restore mobile shell and scoped progress layout   <- nav chip CSS
1ccbb45  fix: restore mobile-first Life Office shell            <- 커리어팀/전체 UI
222ae95  WIP: preserve current state before mobile UI recovery  <- pan clamp
e71510a  feat: complete Claude resume runtime pipeline
221ecb1  fix: allow office canvas panning at 1x zoom            <- last correct pan
07e22d6  WIP: Claude Office visual migration
```

Last visually correct pan state: **`221ecb1`**. Its commit subject is literally the fix that
`222ae95` undid.

## 1. Broken right-pan — introduced by `222ae95`

`222ae95` replaced the library's own bounds handling with a custom clamp. `git log -S` confirms
both `limitToBounds` and `clampCurrent` enter `OfficeGame.tsx` in that commit.

Current lines in `frontend/src/components/life-office/game/OfficeGame.tsx`:

| Lines | What |
|---|---|
| 98-102 | imports `clampCurrent`, `isApplyingPreset`, `notifyManualMove`, `registerCamera`, `registerViewport` from `../adapter/camera-presets` |
| 194-208 | `settleWithinBounds` — snaps the view back after every gesture via `clampCurrent(...)` + `ref.setTransform(...)` |
| 360 | `limitToBounds={false}` on `TransformWrapper` |
| 367-368, 374-375 | `onPanningStop` / `onZoomStop` → `notifyManualMove()` + settle |

The mechanism is stated in the code's own comment at lines 194-197: `limitToBounds` was turned
off because the library measured the viewport-sized wrapper instead of the 1280×1024 canvas,
"which produced asymmetric limits." The replacement `clampCurrent` is now the only clamp in
play — so any error in its right-edge bound is applied unconditionally on every pan end, and
the asymmetry it was meant to fix reappears as a right-pan that springs back.

`221ecb1` had no `clampCurrent` and no `settleWithinBounds`: panning was the library's job.

## 2. "커리어팀 / 전체" UI — introduced by `1ccbb45`, styled by `3ac9b9a`

`git log -S"CAMERA_PRESETS" -- LifeOfficeDemo.tsx` returns exactly one commit: `1ccbb45`.
`git log -S"lo-navigator"` returns `1ccbb45` (markup) and `3ac9b9a` (CSS).

`frontend/src/pages/LifeOfficeDemo.tsx`:

| Lines | What |
|---|---|
| 30-36 | imports `applyPreset`, `CAMERA_PRESETS`, `DEFAULT_MOBILE_PRESET`, `onCameraMovedByUser` |
| 128-130 | `activePreset` state, seeded to `DEFAULT_MOBILE_PRESET` |
| 133-141 | `onCameraMovedByUser` subscription that clears the highlight |
| 144-162 | mobile-only effect that auto-applies the Career preset on mount |
| 305 | topbar string `🏢 Life Office — 커리어팀` |
| 346-362 | `<nav className="lo-navigator">` rendering one `.lo-nav-chip` per preset — this is the chip row; the visible labels ("커리어팀", "전체", …) come from `preset.label` at line 360 |

`frontend/src/components/life-office/life-office.css`: lines **879-914** (`.lo-navigator`,
`::-webkit-scrollbar`, `.lo-nav-chip`, `[aria-pressed="true"]`, `:disabled`) and line **928**
(mobile reposition).

The chip *labels* live in `adapter/camera-presets.ts`, outside the files I was told to inspect.
Line 360 is where they reach the DOM; the label strings themselves were not read.

## 3. Smallest revert / removal set

Two independent edits. Neither requires touching the other.

**Right-pan** — restore `221ecb1` behaviour in `OfficeGame.tsx`:
- set line 360 `limitToBounds={false}` → `true`, **or** correct the right bound inside
  `clampCurrent` (in `adapter/camera-presets.ts`, not inspected here)
- if reverting to library bounds: delete `settleWithinBounds` (194-208) and its two call sites
  in the `onPanningStop` / `onZoomStop` handlers (367-375)
- `git diff 221ecb1 HEAD -- frontend/src/components/life-office/game/OfficeGame.tsx` is the
  precise revert surface

**커리어팀 / 전체 UI** — remove from `LifeOfficeDemo.tsx`:
- delete the `<nav className="lo-navigator">` block, **lines 346-362** — this alone removes the
  chip row from the screen
- then the now-unused 128-130, 133-141, 144-162, and the imports at 30-36
- line 305: edit the topbar string only if "커리어팀" should not appear in the title either
- CSS at 879-914 + 928 is inert once the markup is gone; removing it is optional cleanup

Minimum to make both regressions disappear on screen: **one attribute (OfficeGame.tsx:360)
and one JSX block (LifeOfficeDemo.tsx:346-362).**

## Uncommitted work in the tree

`git diff HEAD` shows one unstaged change, in `LifeOfficeDemo.tsx` (144-162): a fixed 300 ms
`setTimeout` before `applyPreset` was swapped for `applyPresetWhenReady(preset)`. This is
inside the preset machinery of regression #2 and disappears with it. `camera-presets.ts` is
also modified but was outside the inspect list.

Not verified: nothing was rendered or run. The causes above are established from `git log -S`
attribution and the current source, not from observing the two bugs.
