# Visual Migration — Step 4C (BossSprite)

`BossSprite.tsx` copied verbatim (455 lines), import paths rewritten to the adapter, boss role
mapped onto the existing manager employee. No component logic changed. `OfficeGame` not copied,
no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Copied

`frontend/src/components/life-office/game/BossSprite.tsx`

Exports three things, all preserved:

```
BossSprite   (memo)
BossBubble   (re-export of internal Bubble)
MobileBoss   (memo)
```

## Import rewrites

| Original | Now | Resolves? |
|---|---|---|
| `BossState`, `BubbleContent`, `Position` from `@/types` | `../adapter/types` | yes |
| `truncateBubbleText` from `@/utils/bubbleText` | `../adapter/stubs` | yes |
| `./MarqueeText` | unchanged | yes — copied in Step 3.1 |
| `./shared/iconMap`, `./shared/drawBubble`, `./shared/drawArm` | unchanged | yes — copied in Step 4A |

Every import resolves. No component body was touched.

## Adapter addition — `BossState`

`BossState` did not exist in the adapter. Added to `adapter/types.ts`:

```ts
export type BossState =
  | "idle" | "phone_ringing" | "on_phone" | "receiving" | "working"
  | "delegating" | "waiting_permission" | "reviewing" | "completing";
```

**These members are recovered, not guessed.** `BossSprite.tsx:51` declares
`const _STATE_COLORS: Record<BossState, number>` and enumerates all nine keys with their
colours, so the union is fully determined by a file already on disk. This is the first
adapter type in the migration that is exact rather than inferred.

## Boss → manager mapping

Added to `adapter/types.ts`:

```ts
export const BOSS_AGENT_ID: AgentId = "manager";
```

Claude Office treated the boss as a separate actor from the agent roster. Life Office already
has 한매니저 (`manager`) in that seat, so the boss maps onto that employee rather than
introducing a sixth. The constant is declarative only — nothing consumes it yet, because
wiring it is a bridge concern (plan Step 6) and this step does not connect workflow.

`BossSprite` itself takes `state: BossState` as a prop and is agnostic about which employee it
represents, so no code change was needed to achieve the mapping.

## Note on `BossState` vs `AgentPhase`

These are separate unions with different members, and `BossSprite` does not accept
`AgentPhase`. When the bridge lands, the manager will need **two** mappings from its single
semantic `EmployeeActivity`: one to `AgentPhase` if drawn as an agent, one to `BossState` if
drawn as the boss. Which of the two renders 한매니저 is an open decision — `OfficeGame.tsx`
(not yet copied) is where the source picks.

## Future Improvements

Recorded only, not acted on.

1. **Decide whether 한매니저 renders as `BossSprite` or `AgentSprite`.** Rendering as both
   would put two sprites on the same desk. This should be settled before the bridge, not
   during it.
2. `MobileBoss` and `BossBubble` are exported but may be unused once `OfficeGame.tsx` is
   adapted — the source mounted `MobileBoss` on narrow viewports, and Life Office is desktop
   only. Worth checking rather than carrying dead exports.
3. Six of the nine `BossState` members (`phone_ringing`, `on_phone`, `receiving`,
   `delegating`, `waiting_permission`, `completing`) have no counterpart in Life Office's
   five-member `EmployeeActivity`. The bridge will map several to `idle`; that is expected,
   not a defect, but it means most of the boss's colour range will never appear.
4. `_STATE_COLORS` is prefixed with `_`, i.e. unused in the source too. The state-to-colour
   mapping it documents may be dead code — worth confirming before relying on it.

## Status

Twelve components copied so far, all with fully resolved imports:
`OfficeBackground`, `LoadingScreen`, `DigitalClock`, `WallClock`, `DeskGrid`, `DeskMarquee`,
`MarqueeText`, `CityWindow`, `Elevator`, `AgentSprite`, `BossSprite`, plus `city/*` and
`shared/*`.

Still not copied: `OfficeGame.tsx`, `Whiteboard.tsx` + `whiteboard/*`, `SafetySign`,
`EmployeeOfTheMonth`, `PrinterStation`, `TrashCanSprite`, `ZoomControls`, `DebugOverlays`,
and all of `systems/*` and `machines/*`.

## Next

Not started.
