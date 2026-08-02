# Visual Migration — Step 1 (environment)

Step 1 of the plan only: dependencies, `@/*` alias, sprite assets. No game components copied,
no Life Office workflow or UI touched. Nothing was run to verify (tests/lint/typecheck/browser
excluded by the task).

## 1. Dependencies

Installed into `frontend/package.json` as exact pins matching Claude Office:

```
@pixi/react           8.0.5
pixi.js               8.19.0
xstate                5.32.5
@xstate/react         6.1.0
zustand               5.0.14
react-zoom-pan-pinch  4.0.3
```

`npm install` result: 23 packages added, 177 audited, no install errors.
npm reports **1 high severity vulnerability** in the resulting tree — not investigated
(out of Step 1 scope), flagged here so it is not lost.

## 2. `@/*` alias

`frontend/vite.config.ts` — added `resolve.alias` mapping `@` → `./src` via
`fileURLToPath(new URL('./src', import.meta.url))`. Required `node:url` import added.

`frontend/tsconfig.app.json` — added `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`.
Chose `tsconfig.app.json` over `tsconfig.json`, since the root config is a solution file and
`tsconfig.app.json` is the one that owns `include: ["src"]`.

## 3. Sprite assets

Copied `~/Developer/playground/claude-office/frontend/public/sprites/*.png` →
`frontend/public/sprites/`.

**25 PNGs copied, not 30.** The plan's §1e said 30; the source directory actually holds 25.
The plan's enumerated list is complete and correct — the count was wrong, the files are not.
All named sprites are present:

```
boss-rug, chair, coffee-machine, coffee-mug, desk, desk-lamp, elevator_door,
elevator_frame, employee-of-month, floor-tile, headset_small, keyboard_back,
magic-8-ball, monitor_back, old-printer, pen-holder, phone, plant, rubber-duck,
rubiks-cube, stapler, sunglasses, thermos, wall-outlet, watercooler
```

The Next.js scaffold SVGs (`file.svg`, `vercel.svg`, `next.svg`, `globe.svg`, `window.svg`)
were deliberately not copied.

## Not verified

- `@pixi/react` 8.0.5 has not been booted under Vite — this remains the plan's top risk and
  is only exercised at Step 4 (first render).
- The alias resolves nothing yet; no file imports `@/…` in this repo so far.

## Next

Step 2 of the plan: adapter stubs (`adapter/types.ts`, `constants.ts`, `stubs.ts`,
`useOfficeTextures.ts`, `gameStore.ts` with 5 static agents). No game components until Step 3.
