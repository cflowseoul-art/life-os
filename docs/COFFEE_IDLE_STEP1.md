# Coffee Idle — Step 1

New file `adapter/coffeeIdle.ts` (~230 lines) plus a 6-line mount in
`systems/animationSystem.ts`. Nothing else touched.

## How it satisfies the behaviour

A 500 ms interval loop drives a single-slot state machine.

| Requirement | Implementation |
|---|---|
| Only waiting/idle eligible | `isUnoccupied()` — `phase === "idle"` **and** `bubble.content === null` |
| 8-15 s idle | `idleSince` + a per-stretch `idleTarget` drawn from `[8s, 15s]` |
| At most one employee | a single module-level `session`; `pickCandidate` is skipped whenever one exists |
| Existing coffee coordinate | `COFFEE_MACHINE_POSITION` from `adapter/constants.ts:62`, unchanged |
| Stay 2-3 s | `staying` stage deadline from `[2s, 3s]` |
| One short bubble | the single `COFFEE_BUBBLE` constant, written once on arrival |
| Walk back to assigned desk | `getDeskPosition(agent.desk)` — same lookup the store seeds from and the bridge uses |
| 30-60 s cooldown | `cooldownUntil` map, set on completion **and** on cancellation |
| Cancel when work begins | checked every tick at every stage (below) |

Movement reuses `animationSystem.setAgentPath` exactly as the bridge calls it; no pathfinding,
interpolation, or arrival code was modified.

## Workflow isolation

The module imports no workflow module — not `workflow.ts`, not `useWorkflowEngine`, not
`workflowBridge`. It cannot write workflow state or append an event because it holds no
reference to either. It reads `gameStore` and calls `setAgentPath` / `setAgentBubble`, which is
the same visual surface the bridge writes.

Eligibility is therefore inferred purely from the visual layer: the bridge marks an active
employee with a stage bubble and a non-idle phase, so "no bubble + idle phase" is the
observable complement of "doing real work". Working, reviewing, approval-waiting, and reporting
all leave at least one of those two markers set, so none of them are eligible and none can be
interrupted.

Cancellation is evaluated every tick regardless of stage: if the agent's phase leaves `idle`,
or a bubble that is not the coffee bubble appears, the trip is abandoned at once, the coffee
bubble is cleared only if it is still ours, and a cooldown is started. The bridge has already
issued its own path by then, so the module deliberately does **not** issue a competing one.

## Deliberate omissions

- **No cup carrying** — excluded by the task.
- **Phase is never written.** The module only issues paths. Writing `walking_to_desk` would
  collide with the bridge's own phase writes, and phase is also the eligibility signal — setting
  it would make the walking employee look occupied to the next tick. Consequence: an employee
  walking to the machine keeps the `idle` phase, so if `AgentSprite` selects its walk animation
  from phase rather than from motion, the coffee walk will render with the idle pose. Unverified
  — see below.

## Not verified

Nothing was run: tests, lint, typecheck, and browser automation were all excluded. Specifically
unverified: that the walk animates, that `ARRIVE_EPSILON = 24` px matches how close
`setAgentPath` actually settles to a target, and the phase/animation coupling noted above. If
arrival never registers, `WALK_TIMEOUT_MS` (20 s) ends the trip and starts a cooldown rather
than wedging the single session slot — the failure mode is "no coffee happens", not a stuck
employee.

## Future Improvements

1. **The loop is a wall-clock `setInterval`, not the animation tick.** Same objection as the
   bubble timers in Step 1: it keeps running if the scene pauses. Both should eventually move
   onto `animationSystem`'s RAF loop.
2. **Arrival is polled by distance, not reported.** `animationSystem` already computes arrivals
   internally (`arrivals` at line ~195) but exposes no per-target callback. A subscription would
   remove both the epsilon guess and the timeout fallback.
3. **Mounting inside `useAnimationSystem()` is convenient, not principled.** It rides that
   hook's lifetime because `OfficeGame` already calls it and layout was off-limits. A dedicated
   `useCoffeeIdle()` mounted alongside would be clearer once layout edits are allowed.
