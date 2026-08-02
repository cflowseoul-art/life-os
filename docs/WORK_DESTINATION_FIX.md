# Work Destination Fix

One file changed: `adapter/workflowBridge.ts`. One destination corrected. No zone removed,
no constant deleted, no movement/bubble/workflow/visual change.

## The bug

`workflowBridge.ts:83` sent every walking employee to `WORK_POSITIONS[activeId]`:

```ts
animationSystem.setAgentPath(activeId, WORK_POSITIONS[activeId]);
```

`constants.ts:122-128` shows what that is — a generic mid-floor cluster around x 640-760,
y 340-460, with its own doc comment describing it as where an employee *stands* while working:

```
research { x: 640, y: 400 }   analysis { x: 700, y: 460 }
draft    { x: 760, y: 400 }   review   { x: 700, y: 340 }
```

Those coordinates are unrelated to the desks. `gameStore.ts` seeds employees at desks 1, 2, 5,
6 via `getDeskPosition(agent.desk)`, so every stage walked its assignee away from their desk to
stand in the open floor. That is the "standing in a generic work zone" symptom.

## The fix

The `walking` branch now targets the assignee's own desk, using the `deskPositionFor()` helper
already in the file (lines 26-30) — the same `getDeskPosition(agent.desk)` lookup the store
seeds from, so an employee can only be sent to a desk they actually occupy. It is the identical
call the `done` branch and the send-previous-home branch already used; the walking branch was
the only one bypassing it.

Removed the now-unreferenced `WORK_POSITIONS` import (compilation would otherwise carry a dead
binding). `WORK_POSITIONS` itself is left intact in `constants.ts` — no zone removed, per the
requirement.

## Other states — already correct, unchanged

Verified against the requirements without editing:

- **`working` / `reviewing`** (line ~93) only set phase `idle`; they issue no path, so the
  employee stays where the walk left them — now the desk. `reviewing` therefore happens at the
  reviewer's desk with no separate branch needed.
- **Approval waiting** has no employee branch at all, so the assignee holds position at the
  current desk. Approval affects only the boss effect (lines 105-109).
- **`done`** routes home via `deskPositionFor` and clears the bubble.
- **Report area** is used only by the boss effect (`setBossState("completing")`), never as an
  employee walk target.
- **Coffee** has no reference anywhere in the bridge; `COFFEE_MACHINE_POSITION` remains unused
  by workflow-driven movement.

## Not verified

Nothing was run — tests, lint, typecheck, and browser automation were all excluded by the task.
The claim rests on the source: the desk lookup is the same one the store seeds positions from,
so target and seed cannot disagree.

## Future Improvements

`WORK_POSITIONS` in `constants.ts:122-128` is now dead — no reader remains. Its doc comment
("Offset to the right of their desk so the walk is visible") describes an intent the desk
routing no longer serves: walks are now desk-to-desk, so a stage whose assignee is already
seated produces no visible movement at all. If a visible walk per stage is wanted, that is a
design question about where work happens, not a destination bug, and was left alone.
