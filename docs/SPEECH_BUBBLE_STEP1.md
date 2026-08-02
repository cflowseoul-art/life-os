# Speech Bubble — Step 1

One file changed: `adapter/gameStore.ts`. Nothing else needed changing — most of the required
behaviour was already correct in the copied code.

## Already correct — not touched

Inspecting `game/OfficeGame.tsx` and `game/AgentSprite.tsx` first showed three of the five
requirements already met by the original structure:

- **One bubble per employee.** `AgentSprite` is mounted with `renderBubble={false}`
  (OfficeGame.tsx:555, :624), so its own inline bubble branch (AgentSprite.tsx:247-248) never
  fires. The single bubble comes from the dedicated bubbles layer at OfficeGame.tsx:759-777,
  which maps agents to one `<AgentBubble>` each. There was no duplicate to remove.
- **Bubble follows the employee.** That layer positions each bubble container at
  `agent.currentPosition` every render, so it tracks movement with no extra wiring.
- **Original animation and drawing preserved.** `Bubble` in `AgentSprite.tsx:86-158` still calls
  the existing `drawBubble` / `drawIconBadge` (line 137, 142) with the 2x-render-scale-down text
  trick intact. Untouched.

Elevator suppression (`isInElevatorZone`) also already filters the layer. Left as is.

## Changed — auto-expiry

The one missing behaviour: bubbles never disappeared on their own. `setAgentBubble` /
`setBossBubble` wrote content and only ever cleared on the next workflow transition
(`workflowBridge.ts:55, :89, :123`), so a terminal state left a bubble on screen forever.

Added to `adapter/gameStore.ts`, above `patch()`:

- `BUBBLE_DURATION_MS` — the expiry delay.
- `bubbleTimers: Map<string, number>` — one pending expiry per speaker, boss included.
- `scheduleBubbleExpiry(id, hasContent, clear)` — cancels any pending expiry for that id, then
  arms a new one only when content is actually being shown.

`setAgentBubble` and `setBossBubble` now call it before their existing `set(...)`. The write
path is otherwise unchanged, and a new bubble cancels the previous one's timer, so the pending
expiry always belongs to the bubble currently visible.

Not touched: `workflowBridge.ts`, movement, camera, OfficeGame layout, `drawBubble`.

## The timeout value is a guess

`BUBBLE_DURATION_MS = 4000` is **not the original value.** The Claude Office module that owned
this constant is outside the readable paths, and no timeout constant exists anywhere in
`game/` or `adapter/` — I grepped for `BUBBLE_TIMEOUT` / `bubbleTimeout` / `clearBubble` /
`expires` / bare `3000` / `5000` and got nothing. The requirement says "the original timeout";
this is a stand-in that satisfies the mechanism, and the constant is commented as unverified so
it is a one-line fix once the real number is known.

## Not verified

Only that the module still transforms under Vite (HTTP 200). Tests, lint, typecheck, and
browser automation were all excluded by the task, so the visible bubble lifecycle is unobserved.

## Future Improvements

1. **Timers live in the store, not in a tick loop.** `window.setTimeout` inside a zustand setter
   means expiry is wall-clock and keeps running if the scene is paused or unmounted — no cleanup
   path clears `bubbleTimers`. Driving expiry off the existing animation tick would match the
   rest of the visual layer, but that is `animationSystem.ts`, which this task excludes.
2. **Boss and agent bubble paths are near-duplicates.** They differ only in which slice they
   write to. Worth unifying once the boss/agent split settles.
