# Job Context — Duplicate Desktop Inputs Removed

One file changed: `pages/LifeOfficeDemo.tsx`. No CSS, no unrelated JSX.

## The problem

`inputs` was a single JSX constant holding both the three fields and the note + buttons, and it
was rendered twice — desktop left overlay (`lo-overlay-scroll`) and mobile sheet
(`lo-sheet-body`). After `lo-jobbar` was added above the office, desktop showed 회사 / 직무 / JD
twice. Because both copies bound to the same `draft` state, the fields could not be removed from
one surface without splitting the constant.

## The change

Split `inputs` at the boundary between fields and actions — no content edited, only the
fragment boundary moved:

- `inputFields` — the `lo-job-inputs` div (회사, 직무) and the JD textarea. Byte-identical to
  before, including `rows={6}`, placeholders, and the `disabled={running}` bindings.
- `inputActions` — the `lo-note` validation hint, 분석 시작 (`startAndClose`), and 초기화
  (`reset`). Also unchanged.

Render sites:

| Surface | Before | After |
|---|---|---|
| Desktop left overlay | `{inputs}` | `{inputActions}` — fields gone, buttons kept |
| Mobile sheet | `{inputs}` | `{inputFields}{inputActions}` — identical output |
| `lo-jobbar` above office | untouched | untouched |

The mobile sheet renders the same two fragments in the same order that `inputs` emitted, so its
DOM is unchanged.

## Unchanged, by construction

Workflow state, validation, and start behaviour were not touched: `draft`, `patch`, `canStart`,
`startAndClose`, `startRun`, and `reset` are all as they were, and both buttons keep their
original handlers and `disabled={!canStart}` gate. No field's `value`/`onChange` binding moved,
so the desktop `lo-jobbar` and the mobile sheet still write the same `draft` object.

## Not verified

Only that the module still transforms under Vite (HTTP 200). Tests, lint, typecheck, and
browser automation were excluded by the task, so the desktop panel's appearance with the fields
removed — in particular whether the left overlay now looks sparse — is unobserved.

## Future Improvements

1. **The desktop left overlay is now just two buttons and a hint.** It may no longer justify a
   full-height panel; folding 초기화 into `lo-jobbar` would let the overlay go away entirely.
   Layout decision, not a bug.
2. **The validation hint is now separated from the fields it describes on desktop.** "회사·직무·JD를
   모두 입력해야 시작됩니다." renders in the left overlay while the inputs it refers to sit in the
   bar above the office. `lo-jobbar` carries the same message as the button's `title`, so the
   information is not lost, but the placement is odd.
3. **`lo-jobbar` still uses inline styles** with no stylesheet rule for the class — carried over
   from the previous step, since CSS remains off-limits.
