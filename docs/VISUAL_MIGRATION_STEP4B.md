# Visual Migration — Step 4B (close AgentSprite's adapter gaps)

Closes the three gaps recorded in Step 4A. Only adapter files touched; `AgentSprite.tsx` was
not modified, so its behaviour and visuals are exactly as copied. `BossSprite` / `OfficeGame`
not copied, no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Changes

### `adapter/constants.ts` — added `isInElevatorZone`

```ts
export const ELEVATOR_ZONE_HALF = { x: 48, y: 56 } as const;

export function isInElevatorZone(position: Position): boolean {
  return (
    Math.abs(position.x - ELEVATOR_POSITION.x) <= ELEVATOR_ZONE_HALF.x &&
    Math.abs(position.y - ELEVATOR_POSITION.y) <= ELEVATOR_ZONE_HALF.y
  );
}
```

Consumed at `AgentSprite.tsx:229` and `:247` to suppress the name label and speech bubble
while an agent is inside the elevator car.

### `adapter/stubs.ts` — two additions

- `usePreferencesStore`: added `clickToFocusEnabled: boolean`, seeded `false`.
- `useAttentionStore`: added `openFocusPopup: (agentId: string) => void`, a no-op.

Both feed the click-to-focus interaction. With the flag `false`, `AgentSprite` never reaches
`openFocusPopup`, so the no-op is unreachable rather than merely harmless.

## `AgentSprite.tsx` resolution status

All six adapter imports now resolve:

| Symbol | From | Status |
|---|---|---|
| `Position`, `BubbleContent` | `../adapter/types` | resolved |
| `AgentPhase` | `../adapter/types` | resolved |
| `truncateBubbleText` | `../adapter/stubs` | resolved |
| `usePreferencesStore` | `../adapter/stubs` | resolved (this step) |
| `useAttentionStore` | `../adapter/stubs` | resolved (this step) |
| `isInElevatorZone` | `../adapter/constants` | resolved (this step) |

Plus `./shared/iconMap`, `./shared/drawBubble`, `./shared/drawArm`, all resolved since 4A.

## Behaviour caveat — read this one

`isInElevatorZone` is **reimplemented, not recovered.** The original lives in
`systems/queuePositions.ts` (242 lines), which has not been copied and which I have not read.
My version is an axis-aligned rectangle of ±48 × ±56 px around `ELEVATOR_POSITION`; the
source's test may be a different shape, different bounds, or keyed to grid cells rather than
pixels.

The visible consequence of a mismatch is narrow — a name label or speech bubble appearing or
disappearing a few pixels early or late as an agent enters the elevator. It does not affect
posing, walking, or any other visual. But it is the first place in this migration where I have
written original logic rather than moved existing logic, and "preserve original behaviour
exactly" is not strictly satisfiable without reading `queuePositions.ts`.

Both `ELEVATOR_POSITION` and `ELEVATOR_ZONE_HALF` are invented coordinates from Step 2 anyway,
so this function will need revisiting when the real office layout is reconciled.

## Future Improvements

Recorded only, not acted on.

1. **Replace `isInElevatorZone` with the real one** when `systems/queuePositions.ts` is copied
   (plan §1c). At that point delete the adapter version rather than keeping both — `Elevator.tsx`
   already imports `ELEVATOR_POSITION` from `../adapter/constants`, so the two would silently
   diverge.
2. `clickToFocusEnabled` is hard-coded `false`. If click-to-focus is ever wanted, it needs a
   real popup target, not just flipping the flag.
3. The `adapter/index.ts` barrel noted in 4A is still worth doing — `AgentSprite.tsx` imports
   from `../adapter/stubs` on three separate lines.

## Status

`AgentSprite.tsx` fully resolved. All eleven components copied so far
(`OfficeBackground`, `LoadingScreen`, `DigitalClock`, `WallClock`, `DeskGrid`, `DeskMarquee`,
`MarqueeText`, `CityWindow`, `Elevator`, `AgentSprite`, plus `city/*` and `shared/*`) have no
unresolved imports remaining.

## Next

Not started.
