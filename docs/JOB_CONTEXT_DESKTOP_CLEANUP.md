# Job Context — Desktop Actions Cleanup

One file changed: `pages/LifeOfficeDemo.tsx`. No CSS, no other overlay content touched.

## Changes

**1. `lo-jobbar` completed.** The requirement lists 초기화 and the validation hint as things the
bar must *keep* — it did not have them yet (the previous step left both only in the desktop
overlay). Added, using the existing handlers verbatim:

- 초기화 button — `className="lo-btn"`, `onClick={reset}`, same as the overlay's copy. It had
  no `disabled` condition before and still has none.
- Validation hint — the same `lo-note` div and the same two strings, given
  `flex: "1 1 100%"` so it wraps onto its own line under the controls. Inline style only,
  consistent with the rest of the bar; no CSS added.

**2. Desktop left overlay removed.** After its fields went in the previous step, the panel held
only `{inputActions}` — the hint and the two buttons, all now in the bar. The whole
`lo-overlay lo-panel-left lo-desktop-only` section was removed rather than left as an empty
panel frame.

## Unchanged

- **Mobile sheet** — still renders `{inputFields}{inputActions}`, untouched. `inputActions` is
  still referenced there, so the constant stays.
- **Right overlay** (`progress` + `result`), header, tab bar, FAB, sheet — not touched.
- **Workflow state, validation, handlers, disabled conditions** — `draft`, `patch`, `canStart`,
  `startRun`, `startAndClose`, `reset` all unchanged. 분석 시작 keeps `disabled={!canStart}` and
  its `title`; 초기화 keeps no disabled condition. Nothing was rebound.

Note the two 분석 시작 buttons still differ in handler, as they did before this step: the bar
calls `startRun`, the mobile sheet calls `startAndClose` (which also closes the sheet). That
asymmetry is pre-existing and correct for each surface.

## Not verified

Only that the module still transforms under Vite (HTTP 200). Tests, lint, typecheck, and
browser automation were excluded, so the desktop layout with the left panel gone — in
particular whether the office now sits noticeably off-centre with only a right overlay — is
unobserved.

## Future Improvements

1. **Desktop is now asymmetric**: right overlay only. If that reads badly, the fix is a layout
   decision (centre the office, or widen the right panel), not a bug in this change.
2. **`lo-jobbar` still has no stylesheet rule** — the class exists but all layout is inline,
   carried over from two steps ago because CSS stays off-limits. The hint's
   `flex: "1 1 100%"` line-wrap is the kind of thing that belongs in a rule.
3. **`inputFields` / `inputActions` now have exactly one consumer each** (the mobile sheet uses
   both together). The split existed to let desktop and mobile diverge; with the desktop panel
   gone, they could collapse back into one constant.
