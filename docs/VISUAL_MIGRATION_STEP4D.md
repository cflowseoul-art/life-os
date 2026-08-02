# Visual Migration — Step 4D (BossSprite gap closure)

Verified every `BossSprite.tsx` import against what the adapter actually exports, and closed
the one real gap found. `BossSprite.tsx` not modified — behaviour and visuals are exactly as
copied in 4C. `OfficeGame` not copied, no workflow connected, nothing rendered.
Nothing was run to verify (tests/lint/typecheck/browser excluded).

## Import verification — all symbols present

Checked symbol-by-symbol rather than trusting 4C's summary:

| Symbol | Source | Present? |
|---|---|---|
| `BossState`, `BubbleContent`, `Position` | `../adapter/types` | yes |
| `truncateBubbleText` | `../adapter/stubs` (line 89) | yes |
| `MarqueeText` | `./MarqueeText` (line 33) | yes |
| `ICON_MAP` | `./shared/iconMap` (line 9) | yes |
| `drawBubble`, `drawIconBadge` | `./shared/drawBubble` (lines 18, 81) | yes |
| `drawRightArm`, `drawLeftArm` | `./shared/drawArm` (lines 34, 77) | yes |

No unresolved module paths. 4C's claim held.

## Real gap found — `BubbleContent.type`

Import *paths* all resolved, but a **field** did not. `BossSprite.tsx:109`:

```ts
const { type = "thought", icon } = content;
```

`BubbleContent` in the adapter had no `type` field — Step 2 guessed `urgent?: boolean`
instead. Destructuring a property absent from the type is a compile error, and the value
feeds `drawBubble(g, w, h, type)`, whose signature is
`type: "thought" | "speech" = "thought"`. So this is a visual difference, not just a type
complaint: without it there is no way to render a speech bubble rather than a thought bubble.

Fixed in `adapter/types.ts` — replaced the guessed `urgent?: boolean` with:

```ts
type?: "thought" | "speech";
```

Union members taken from `drawBubble`'s own signature, so they are recovered, not guessed.

`AgentSprite.tsx:87` destructures the identical `{ type = "thought", icon }`, so this single
change fixes both sprites. `urgent` was removed rather than kept — it was invented in Step 2,
and grepping both sprite files shows nothing reads it.

## Why 4C missed this

4C checked that every import path resolved to a module. It did not check that every *field
access* resolved against the adapter's type shape. Path resolution and structural
compatibility are separate failures, and only the first was verified.

The same blind spot applies to everything copied so far: `Position` and `AgentAnimationState`
have been confirmed by field access, but `AgentPhase` has not, because nothing branches on it
yet.

## Future Improvements

Recorded only, not acted on.

1. **Field-level verification is worth one pass over the copied files** before rendering.
   Every remaining Step 2 guess (`AgentPhase` members, `CANVAS` dimensions, all coordinates
   in `constants.ts`, the clock cycle order) is still unvalidated, and this step shows the
   failure mode is a silent type/visual mismatch rather than a missing import.
2. The 4C question stands unchanged: whether 한매니저 renders as `BossSprite` or
   `AgentSprite`. Nothing in this step bears on it.
3. `_STATE_COLORS` in `BossSprite.tsx` is still underscore-prefixed and unused; the boss's
   colour range may be dead code in the source too.

## Status

`BossSprite.tsx` fully resolved, at both module and field level for the paths exercised.
Twelve components copied, none with unresolved imports.

## Next

Not started.
